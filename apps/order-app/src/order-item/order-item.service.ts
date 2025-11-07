import { Injectable } from '@nestjs/common';
import { OrderItemListByOrderDto, OrderItemAddDto, OrderItemRemoveDto } from '../../../../libs/shared/dto/order.dto';
import { PrismaService } from '@order-app/prisma/prisma.service';
import {
  EntityNotFoundRpcException,
  InternalServerRpcException,
  ValidationRpcException,
} from '@shared/exceptions/rpc-exceptions';
import { OrderItemResponse } from '@shared/types/order.types';

/**
 * Interface cho OrderItem Service
 * Định nghĩa các phương thức quản lý order items
 */
export interface IOderItemService {
  /**
   * Lấy danh sách items của order
   * @param dto - DTO chứa orderId
   * @returns Danh sách order items
   */
  listByOrder(dto: OrderItemListByOrderDto): Promise<OrderItemResponse[]>;

  /**
   * Thêm item vào order
   * @param dto - DTO chứa thông tin item
   * @returns Order item đã tạo
   */
  addItem(dto: OrderItemAddDto): Promise<OrderItemResponse>;

  /**
   * Xóa item khỏi order
   * @param dto - DTO chứa ID của item
   */
  removeItem(dto: OrderItemRemoveDto): Promise<void>;
}

/**
 * OrderItemService - Service quản lý order items
 *
 * Xử lý business logic liên quan đến:
 * - Lấy danh sách items của order
 * - Thêm item vào order và cập nhật tổng tiền
 * - Xóa item khỏi order và điều chỉnh tổng tiền
 *
 * **Lưu ý:** Mọi thao tác thêm/xóa item đều cập nhật totalInt của order
 */
@Injectable()
export class OrderItemService implements IOderItemService {
  /**
   * Constructor - Inject PrismaService
   *
   * @param prisma - Prisma client để truy cập database
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách items của order
   *
   * @param dto - DTO chứa orderId
   * @returns Danh sách order items được sắp xếp theo thời gian tạo
   * @throws EntityNotFoundRpcException nếu order không tồn tại
   */
  async listByOrder(dto: OrderItemListByOrderDto): Promise<OrderItemResponse[]> {
    const orderExists = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true },
    });

    if (!orderExists) {
      throw new EntityNotFoundRpcException('Order', dto.orderId);
    }

    const items = await this.prisma.orderItem.findMany({
      where: { orderId: dto.orderId },
      orderBy: { createdAt: 'asc' },
    });

    return items.map(item => this.toOrderItemResponse(item));
  }

  /**
   * Thêm item vào order
   *
   * Thực hiện các bước:
   * 1. Validate số lượng và đơn giá
   * 2. Kiểm tra order tồn tại
   * 3. Tạo order item và cập nhật tổng tiền order (transaction)
   *
   * @param dto - DTO chứa thông tin item (orderId, productId, quantity, priceInt)
   * @returns Order item đã tạo
   * @throws ValidationRpcException nếu quantity hoặc priceInt không hợp lệ
   * @throws EntityNotFoundRpcException nếu order không tồn tại
   * @throws InternalServerRpcException nếu có lỗi database
   */
  async addItem(dto: OrderItemAddDto): Promise<OrderItemResponse> {
    const { orderId, productId, quantity, priceInt } = dto;

    if (quantity <= 0) {
      throw new ValidationRpcException('Số lượng phải lớn hơn 0');
    }

    if (priceInt <= 0) {
      throw new ValidationRpcException('Đơn giá phải lớn hơn 0');
    }

    try {
      const orderExists = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true },
      });

      if (!orderExists) {
        throw new EntityNotFoundRpcException('Order', orderId);
      }

      const totalIncrement = priceInt * quantity;

      const [orderItem] = await this.prisma.$transaction([
        this.prisma.orderItem.create({
          data: {
            orderId,
            productId,
            quantity,
            priceInt,
          },
        }),
        this.prisma.order.update({
          where: { id: orderId },
          data: {
            totalInt: {
              increment: totalIncrement,
            },
            updatedAt: new Date(),
          },
        }),
      ]);

      return this.toOrderItemResponse(orderItem);
    } catch (error) {
      if (error instanceof EntityNotFoundRpcException || error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[OrderItemService] addItem error:', {
        orderId,
        productId,
        quantity,
        priceInt,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Không thể thêm sản phẩm vào đơn hàng');
    }
  }

  /**
   * Xóa item khỏi order
   *
   * Thực hiện các bước:
   * 1. Kiểm tra order item tồn tại
   * 2. Tính toán số tiền cần giảm từ order total
   * 3. Xóa item và cập nhật tổng tiền order (transaction)
   * 4. Đảm bảo order total không âm (dùng Math.min)
   *
   * @param dto - DTO chứa ID của item cần xóa
   * @throws EntityNotFoundRpcException nếu order item không tồn tại
   * @throws InternalServerRpcException nếu có lỗi database
   */
  async removeItem(dto: OrderItemRemoveDto): Promise<void> {
    let context: {
      orderId: string;
      totalAdjustment: number;
    } | null = null;

    try {
      const orderItem = await this.prisma.orderItem.findUnique({
        where: { id: dto.id },
        include: {
          order: {
            select: {
              id: true,
              totalInt: true,
            },
          },
        },
      });

      if (!orderItem) {
        throw new EntityNotFoundRpcException('OrderItem', dto.id);
      }

      const totalAdjustment = orderItem.priceInt * orderItem.quantity;
      const decrementValue = Math.min(orderItem.order.totalInt, totalAdjustment);
      context = {
        orderId: orderItem.orderId,
        totalAdjustment,
      };

      await this.prisma.$transaction(async tx => {
        await tx.orderItem.delete({
          where: { id: dto.id },
        });

        await tx.order.update({
          where: { id: orderItem.orderId },
          data: {
            totalInt: {
              decrement: decrementValue,
            },
            updatedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (error instanceof EntityNotFoundRpcException) {
        throw error;
      }

      console.error('[OrderItemService] removeItem error:', {
        orderItemId: dto.id,
        orderId: context?.orderId,
        totalAdjustment: context?.totalAdjustment,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Không thể xóa sản phẩm khỏi đơn hàng');
    }
  }

  /**
   * Chuyển đổi Prisma order item sang OrderItemResponse DTO
   *
   * @param item - Order item từ Prisma
   * @returns OrderItemResponse DTO
   * @private
   */
  private toOrderItemResponse(item: {
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    imageUrls: string[];
    quantity: number;
    priceInt: number;
    createdAt: Date;
  }): OrderItemResponse {
    return {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      imageUrls: item.imageUrls,
      quantity: item.quantity,
      priceInt: item.priceInt,
      createdAt: item.createdAt,
    };
  }
}
