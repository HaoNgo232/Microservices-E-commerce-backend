import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  OrderCreateDto,
  OrderIdDto,
  OrderUpdateStatusDto,
  OrderCancelDto,
  OrderListDto,
  OrderUpdatePaymentStatusDto,
} from '@shared/dto/order.dto';
import { PrismaService } from '@order-app/prisma/prisma.service';
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
  ConflictRpcException,
} from '@shared/exceptions/rpc-exceptions';
import { OrderResponse, PaginatedOrdersResponse } from '@shared/types/order.types';
import { OrderStatus } from '@shared/types';
import { EVENTS } from '@shared/events';
import { firstValueFrom, timeout, catchError, of, throwError } from 'rxjs';
import { ProductResponse } from '@shared/types/product.types';

/**
 * Interface cho Orders Service
 * Định nghĩa các phương thức quản lý orders
 */
export interface IOrdersService {
  /**
   * Tạo order mới với items
   * @param dto - DTO chứa thông tin order
   * @returns Order đã tạo
   */
  create(dto: OrderCreateDto): Promise<OrderResponse>;

  /**
   * Lấy chi tiết order theo ID
   * @param dto - DTO chứa orderId
   * @returns Order với đầy đủ items
   */
  get(dto: OrderIdDto): Promise<OrderResponse>;

  /**
   * Lấy danh sách orders của user với phân trang
   * @param dto - DTO chứa userId và thông tin phân trang
   * @returns Danh sách orders có phân trang
   */
  listByUser(dto: OrderListDto): Promise<PaginatedOrdersResponse>;

  /**
   * Cập nhật trạng thái order
   * @param dto - DTO chứa orderId và status mới
   * @returns Order đã cập nhật
   */
  updateStatus(dto: OrderUpdateStatusDto): Promise<OrderResponse>;

  /**
   * Cập nhật paymentStatus của order
   */
  updatePaymentStatus(dto: OrderUpdatePaymentStatusDto): Promise<OrderResponse>;

  /**
   * Hủy order
   * @param dto - DTO chứa orderId
   * @returns Order đã hủy
   */
  cancel(dto: OrderCancelDto): Promise<OrderResponse>;
}

/**
 * OrdersService - Service quản lý orders
 *
 * Xử lý business logic liên quan đến:
 * - Tạo order mới (validate sản phẩm, kiểm tra tồn kho, tạo items)
 * - Lấy thông tin order
 * - Liệt kê orders của user với phân trang
 * - Cập nhật trạng thái order (validate chuyển trạng thái hợp lệ)
 * - Hủy order (hoàn trả tồn kho)
 *
 * **Tích hợp microservices:**
 * - Product Service: Validate sản phẩm, kiểm tra tồn kho, cập nhật tồn kho
 * - Cart Service: Xóa giỏ hàng sau khi tạo order thành công
 */
@Injectable()
export class OrdersService implements IOrdersService {
  /**
   * Constructor - Inject dependencies
   *
   * @param prisma - Prisma client để truy cập database
   * @param productClient - NATS client gọi Product Service
   * @param cartClient - NATS client gọi Cart Service
   */
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
    @Inject('CART_SERVICE') private readonly cartClient: ClientProxy,
  ) {}

  /**
   * Tạo order mới với items
   *
   * Quy trình:
   * 1. Validate mảng items không rỗng
   * 2. Kiểm tra sản phẩm tồn tại và đủ tồn kho
   * 3. Tính tổng tiền từ items
   * 4. Tạo order và items trong transaction
   * 5. Giảm tồn kho sản phẩm (fire-and-forget)
   * 6. Xóa giỏ hàng của user (fire-and-forget)
   *
   * @param dto - DTO chứa userId, addressId, items
   * @returns Order đã tạo với đầy đủ items
   * @throws ValidationRpcException nếu items rỗng hoặc sản phẩm không hợp lệ
   */
  async create(dto: OrderCreateDto): Promise<OrderResponse> {
    // Step 1: Validate items array
    if (!dto.items || dto.items.length === 0) {
      throw new ValidationRpcException('Order must contain at least one item');
    }

    // Step 2: Validate products exist and have sufficient stock
    await this.validateProductsAndStock(dto.items);

    // Step 3: Calculate total amount from items
    const totalInt = dto.items.reduce((sum, item) => sum + item.priceInt * item.quantity, 0);

    // Step 4: Create order with items in a transaction
    const order = await this.prisma.order.create({
      data: {
        userId: dto.userId,
        addressId: dto.addressId,
        status: OrderStatus.PENDING,
        totalInt,
        items: {
          create: dto.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            priceInt: item.priceInt,
          })),
        },
      },
      select: {
        id: true,
        userId: true,
        addressId: true,
        status: true,
        totalInt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            priceInt: true,
            orderId: true,
            createdAt: true,
          },
        },
      },
    });

    // Step 5: Decrement product stock (fire-and-forget)
    this.decrementProductStock(dto.items);

    // Step 6: Clear user's cart after successful order (fire-and-forget)
    this.clearUserCart(dto.userId);

    console.log(`[OrdersService] Created order: ${order.id} with ${order.items.length} items`);
    return order as OrderResponse;
  }

  /**
   * Lấy chi tiết order theo ID
   *
   * @param dto - DTO chứa orderId
   * @returns Order với đầy đủ items
   * @throws EntityNotFoundRpcException nếu order không tồn tại
   */
  async get(dto: OrderIdDto): Promise<OrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.id },
      select: {
        id: true,
        userId: true,
        addressId: true,
        status: true,
        totalInt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            priceInt: true,
            orderId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new EntityNotFoundRpcException('Order', dto.id);
    }

    return order as OrderResponse;
  }

  /**
   * Lấy danh sách orders của user với phân trang
   *
   * @param query - DTO chứa userId, page, pageSize
   * @returns Danh sách orders có phân trang, sắp xếp theo thời gian tạo mới nhất
   */
  async listByUser(query: OrderListDto): Promise<PaginatedOrdersResponse> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    // Get total count
    const total = await this.prisma.order.count({
      where: { userId: query.userId },
    });

    // Get paginated orders
    const orders = await this.prisma.order.findMany({
      where: { userId: query.userId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    });

    return {
      orders: orders as OrderResponse[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Cập nhật trạng thái order
   *
   * Quy trình:
   * 1. Kiểm tra order tồn tại
   * 2. Validate chuyển trạng thái hợp lệ (PENDING → PAID/CANCELLED, PAID → SHIPPED/CANCELLED)
   * 3. Cập nhật status trong database
   * 4. Nếu chuyển sang CANCELLED: hoàn trả tồn kho (fire-and-forget)
   *
   * @param dto - DTO chứa orderId và status mới
   * @returns Order đã cập nhật
   * @throws EntityNotFoundRpcException nếu order không tồn tại
   * @throws ValidationRpcException nếu chuyển trạng thái không hợp lệ
   */
  async updateStatus(dto: OrderUpdateStatusDto): Promise<OrderResponse> {
    // Check if order exists
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: dto.id },
      include: { items: true },
    });

    if (!existingOrder) {
      throw new EntityNotFoundRpcException('Order', dto.id);
    }

    // Validate status transition
    this.validateStatusTransition(existingOrder.status, dto.status);

    // Update order status
    const updatedOrder = await this.prisma.order.update({
      where: { id: dto.id },
      data: {
        status: dto.status,
        updatedAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    // If cancelled, restore stock (fire-and-forget)
    if (dto.status === OrderStatus.CANCELLED) {
      this.restoreProductStock(existingOrder.items);
    }

    console.log(`[OrdersService] Updated order ${dto.id} status to ${dto.status}`);
    return updatedOrder as OrderResponse;
  }

  /**
   * Cập nhật paymentStatus của order
   * @param dto - { id, paymentStatus }
   */
  async updatePaymentStatus(dto: OrderUpdatePaymentStatusDto): Promise<OrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.id },
      include: { items: true },
    });

    if (!order) {
      throw new EntityNotFoundRpcException('Order', dto.id);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: dto.id },
      data: {
        paymentStatus: dto.paymentStatus,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    console.log(`[OrdersService] Updated order ${dto.id} paymentStatus to ${dto.paymentStatus}`);
    return updatedOrder as OrderResponse;
  }

  /**
   * Hủy order
   *
   * Quy tắc hủy:
   * - Chỉ cho phép hủy order PENDING hoặc PAID
   * - Không cho phép hủy order SHIPPED hoặc đã CANCELLED
   * - Tự động hoàn trả tồn kho khi hủy (fire-and-forget)
   *
   * @param dto - DTO chứa orderId và lý do hủy (optional)
   * @returns Order đã hủy
   * @throws EntityNotFoundRpcException nếu order không tồn tại
   * @throws ConflictRpcException nếu order đã bị hủy
   * @throws ValidationRpcException nếu không thể hủy (đã ship)
   */
  async cancel(dto: OrderCancelDto): Promise<OrderResponse> {
    // Check if order exists
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: dto.id },
      include: { items: true },
    });

    if (!existingOrder) {
      throw new EntityNotFoundRpcException('Order', dto.id);
    }

    // Validate that order can be cancelled
    if ((existingOrder.status as OrderStatus) === OrderStatus.CANCELLED) {
      throw new ConflictRpcException('Order is already cancelled');
    }

    if ((existingOrder.status as OrderStatus) === OrderStatus.SHIPPED) {
      throw new ValidationRpcException('Cannot cancel shipped orders');
    }

    // Update order to cancelled status
    const cancelledOrder = await this.prisma.order.update({
      where: { id: dto.id },
      data: {
        status: OrderStatus.CANCELLED,
        updatedAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    // Restore product stock (fire-and-forget)
    this.restoreProductStock(existingOrder.items);

    console.log(`[OrdersService] Cancelled order: ${dto.id}`);
    return cancelledOrder as OrderResponse;
  }

  /**
   * Kiểm tra sản phẩm tồn tại và đủ tồn kho
   *
   * Quy trình:
   * 1. Lấy danh sách productIds từ items
   * 2. Gọi Product Service để lấy thông tin sản phẩm (timeout 5s)
   * 3. Kiểm tra tất cả sản phẩm đều tồn tại
   * 4. Kiểm tra từng sản phẩm có đủ tồn kho
   *
   * @param items - Danh sách items cần validate
   * @throws ValidationRpcException nếu sản phẩm không tồn tại hoặc không đủ tồn kho
   * @private
   */
  private async validateProductsAndStock(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    try {
      // Get all product IDs
      const productIds = items.map(item => item.productId);

      // Fetch products from product-service
      const products = await firstValueFrom(
        this.productClient
          .send<ProductResponse[], { ids: string[] }>(EVENTS.PRODUCT.GET_BY_IDS, {
            ids: productIds,
          })
          .pipe(
            timeout(5000),
            catchError(error => {
              console.error('[OrdersService] Error fetching products:', error);
              if (error instanceof Error && error.name === 'TimeoutError') {
                return throwError(
                  () => new ValidationRpcException('Product service không phản hồi'),
                );
              }
              return throwError(() => new ValidationRpcException('Failed to validate products'));
            }),
          ),
      );

      // Check all products were found
      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map(p => p.id));
        const missingIds = productIds.filter(id => !foundIds.has(id));
        throw new ValidationRpcException(`Products not found: ${missingIds.join(', ')}`);
      }

      // Validate stock for each item
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          throw new ValidationRpcException(`Product ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new ValidationRpcException(
            `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
          );
        }
      }
    } catch (error) {
      if (error instanceof ValidationRpcException) {
        throw error;
      }
      console.error('[OrdersService] validateProductsAndStock error:', error);
      throw new ValidationRpcException('Failed to validate products and stock');
    }
  }

  /**
   * Giảm tồn kho sản phẩm sau khi tạo order
   *
   * Fire-and-forget operation: Gửi message qua NATS không chờ response
   * Timeout: 5s, bỏ qua lỗi nếu có
   *
   * @param items - Danh sách items cần giảm tồn kho
   * @private
   */
  private decrementProductStock(items: Array<{ productId: string; quantity: number }>): void {
    for (const item of items) {
      firstValueFrom(
        this.productClient
          .send(EVENTS.PRODUCT.DEC_STOCK, {
            productId: item.productId,
            quantity: item.quantity,
          })
          .pipe(
            timeout(5000),
            catchError(error => {
              console.error(
                `[OrdersService] Failed to decrement stock for product ${item.productId}:`,
                error,
              );
              return of(null);
            }),
          ),
      ).catch(() => {
        // Ignore errors for fire-and-forget
      });
    }
  }

  /**
   * Hoàn trả tồn kho sản phẩm sau khi hủy order
   *
   * Fire-and-forget operation: Gửi message qua NATS không chờ response
   * Timeout: 5s, bỏ qua lỗi nếu có
   *
   * @param items - Danh sách items cần hoàn trả tồn kho
   * @private
   */
  private restoreProductStock(items: Array<{ productId: string; quantity: number }>): void {
    for (const item of items) {
      firstValueFrom(
        this.productClient
          .send(EVENTS.PRODUCT.INC_STOCK, {
            productId: item.productId,
            quantity: item.quantity,
          })
          .pipe(
            timeout(5000),
            catchError(error => {
              console.error(
                `[OrdersService] Failed to restore stock for product ${item.productId}:`,
                error,
              );
              return of(null);
            }),
          ),
      ).catch(() => {
        // Ignore errors for fire-and-forget
      });
    }
  }

  /**
   * Xóa giỏ hàng của user sau khi tạo order thành công
   *
   * Fire-and-forget operation: Gửi message qua NATS không chờ response
   * Timeout: 5s, bỏ qua lỗi nếu có
   *
   * @param userId - ID của user cần xóa giỏ hàng
   * @private
   */
  private clearUserCart(userId: string): void {
    firstValueFrom(
      this.cartClient.send(EVENTS.CART.CLEAR, { userId }).pipe(
        timeout(5000),
        catchError(error => {
          console.error(`[OrdersService] Failed to clear cart for user ${userId}:`, error);
          return of(null);
        }),
      ),
    ).catch(() => {
      // Ignore errors for fire-and-forget
    });
  }

  /**
   * Kiểm tra tính hợp lệ của chuyển trạng thái order
   *
   * Quy tắc chuyển trạng thái:
   * - PENDING → PROCESSING, CANCELLED
   * - PROCESSING → SHIPPED, CANCELLED
   * - SHIPPED → DELIVERED
   * - DELIVERED → (không thể chuyển)
   * - CANCELLED → (không thể chuyển)
   *
   * @param currentStatus - Trạng thái hiện tại
   * @param newStatus - Trạng thái mới muốn chuyển
   * @throws ValidationRpcException nếu chuyển trạng thái không hợp lệ
   * @private
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [], // Cannot change once delivered
      [OrderStatus.CANCELLED]: [], // Cannot change once cancelled
    };

    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      throw new ValidationRpcException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
