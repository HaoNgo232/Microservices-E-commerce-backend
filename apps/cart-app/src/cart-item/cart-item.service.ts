import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import {
  ValidationRpcException,
  EntityNotFoundRpcException,
  ServiceUnavailableRpcException,
} from '@shared/exceptions/rpc-exceptions';

@Injectable()
export class CartItemService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
  ) {}

  async addItem(cartId: string, productId: string, quantity: number) {
    // Validate quantity
    if (quantity <= 0) {
      throw new ValidationRpcException('Số lượng phải lớn hơn 0');
    }

    // Validate product exists
    await this.validateProductExists(productId);

    // Upsert CartItem (add or update)
    const cartItem = await this.prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId, productId },
      },
      update: {
        quantity: { increment: quantity }, // Add to existing
      },
      create: {
        cartId,
        productId,
        quantity,
      },
    });

    return cartItem;
  }

  async updateQuantity(cartId: string, productId: string, quantity: number) {
    // Validate quantity
    if (quantity < 0) {
      throw new ValidationRpcException('Số lượng không hợp lệ');
    }

    const cartItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId, productId },
      },
    });

    if (!cartItem) {
      throw new EntityNotFoundRpcException('CartItem', productId);
    }

    // Delete if quantity = 0
    if (quantity === 0) {
      await this.prisma.cartItem.delete({
        where: { id: cartItem.id },
      });
      return null;
    }

    // Update quantity
    const updated = await this.prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity },
    });

    return updated;
  }

  async removeItem(cartId: string, productId: string) {
    // Idempotent: no error if not exists
    await this.prisma.cartItem.deleteMany({
      where: {
        cartId,
        productId,
      },
    });

    return { success: true };
  }

  async findByCartAndProduct(cartId: string, productId: string) {
    return this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId, productId },
      },
    });
  }

  /**
   * Validate product exists by calling product-service
   * @private
   */
  private async validateProductExists(productId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.productClient.send(EVENTS.PRODUCT.GET_BY_ID, { id: productId }).pipe(timeout(5000)),
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ServiceUnavailableRpcException('Product service không phản hồi');
      }
      // If product not found, product-service will throw EntityNotFoundRpcException
      throw error;
    }
  }
}
