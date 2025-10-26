import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  OrderCreateDto,
  OrderIdDto,
  OrderListByUserDto,
  OrderUpdateStatusDto,
  OrderCancelDto,
} from '@shared/dto/order.dto';
import { PrismaService } from '@order-app/prisma/prisma.service';
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
  ConflictRpcException,
} from '@shared/exceptions/rpc-exceptions';
import { OrderResponse, PaginatedOrdersResponse } from '@shared/types/order.types';
import { EVENTS } from '@shared/events';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { ProductResponse } from '@shared/types/product.types';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
    @Inject('CART_SERVICE') private readonly cartClient: ClientProxy,
  ) {}

  /**
   * Create new order with items
   * Validates items, checks stock availability, and clears cart
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
        status: 'PENDING',
        totalInt,
        items: {
          create: dto.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            priceInt: item.priceInt,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Step 5: Decrement product stock (fire-and-forget)
    this.decrementProductStock(dto.items);

    // Step 6: Clear user's cart after successful order (fire-and-forget)
    this.clearUserCart(dto.userId);

    console.log(`[OrdersService] Created order: ${order.id} with ${order.items.length} items`);
    return this.mapToOrderResponse(order);
  }

  /**
   * Get order by ID
   * Returns order with items
   */
  async get(dto: OrderIdDto): Promise<OrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.id },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new EntityNotFoundRpcException('Order', dto.id);
    }

    return this.mapToOrderResponse(order);
  }

  /**
   * List orders by user with pagination
   * Returns paginated list of orders
   */
  async listByUser(dto: OrderListByUserDto): Promise<PaginatedOrdersResponse> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    // Get total count
    const total = await this.prisma.order.count({
      where: { userId: dto.userId },
    });

    // Get paginated orders
    const orders = await this.prisma.order.findMany({
      where: { userId: dto.userId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    });

    return {
      orders: orders.map(order => this.mapToOrderResponse(order)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update order status
   * Validates status transitions and handles stock restoration on cancellation
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
    if (dto.status === 'CANCELLED') {
      this.restoreProductStock(existingOrder.items);
    }

    console.log(`[OrdersService] Updated order ${dto.id} status to ${dto.status}`);
    return this.mapToOrderResponse(updatedOrder);
  }

  /**
   * Cancel order
   * Only allows cancellation of PENDING orders
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
    if (existingOrder.status === 'CANCELLED') {
      throw new ConflictRpcException('Order is already cancelled');
    }

    if (existingOrder.status === 'SHIPPED') {
      throw new ValidationRpcException('Cannot cancel shipped orders');
    }

    // Update order to cancelled status
    const cancelledOrder = await this.prisma.order.update({
      where: { id: dto.id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    // Restore product stock (fire-and-forget)
    this.restoreProductStock(existingOrder.items);

    console.log(`[OrdersService] Cancelled order: ${dto.id}`);
    return this.mapToOrderResponse(cancelledOrder);
  }

  /**
   * Validate products exist and have sufficient stock
   * @throws ValidationRpcException if any product is invalid or out of stock
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
              throw new ValidationRpcException('Failed to validate products');
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
   * Decrement product stock after order creation
   * Fire-and-forget operation
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
   * Restore product stock after order cancellation
   * Fire-and-forget operation
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
   * Clear user's cart after successful order
   * Fire-and-forget operation
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
   * Validate status transition
   * Prevents invalid status changes
   * @private
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      PENDING: ['PAID', 'CANCELLED'],
      PAID: ['SHIPPED', 'CANCELLED'],
      SHIPPED: [], // Cannot change once shipped
      CANCELLED: [], // Cannot change once cancelled
    };

    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      throw new ValidationRpcException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Map Prisma order to OrderResponse
   * @private
   */
  private mapToOrderResponse(order: {
    id: string;
    userId: string;
    addressId: string | null;
    status: string;
    totalInt: number;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      orderId: string;
      productId: string;
      quantity: number;
      priceInt: number;
      createdAt: Date;
    }>;
  }): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      addressId: order.addressId,
      status: order.status,
      totalInt: order.totalInt,
      items: order.items.map(item => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        priceInt: item.priceInt,
        createdAt: item.createdAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
