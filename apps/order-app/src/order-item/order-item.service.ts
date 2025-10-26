import { Injectable } from '@nestjs/common';
import {
  OrderItemListByOrderDto,
  OrderItemAddDto,
  OrderItemRemoveDto,
} from '../../../../libs/shared/dto/order.dto';
import { PrismaService } from '@order-app/prisma/prisma.service';
import {
  EntityNotFoundRpcException,
  InternalServerRpcException,
  ValidationRpcException,
} from '@shared/exceptions/rpc-exceptions';
import { OrderItemResponse } from '@shared/types/order.types';

@Injectable()
export class OrderItemService {
  constructor(private readonly prisma: PrismaService) {}

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

  private toOrderItemResponse(item: {
    id: string;
    orderId: string;
    productId: string;
    quantity: number;
    priceInt: number;
    createdAt: Date;
  }): OrderItemResponse {
    return {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      priceInt: item.priceInt,
      createdAt: item.createdAt,
    };
  }
}
