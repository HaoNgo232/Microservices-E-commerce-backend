import { Injectable } from '@nestjs/common';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { ProductAppClient } from '@cart-app/product-app/product-app.client';
import {
  ValidationRpcException,
  EntityNotFoundRpcException,
} from '@shared/exceptions/rpc-exceptions';

@Injectable()
export class CartItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productClient: ProductAppClient,
  ) {}

  async addItem(cartId: string, productId: string, quantity: number) {
    // Validate quantity
    if (quantity <= 0) {
      throw new ValidationRpcException('Số lượng phải lớn hơn 0');
    }

    // Validate product exists
    const product = await this.productClient.getProductById(productId);
    if (!product) {
      throw new EntityNotFoundRpcException('Product', productId);
    }

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
}
