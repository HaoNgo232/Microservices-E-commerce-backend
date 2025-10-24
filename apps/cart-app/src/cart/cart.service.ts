import { Injectable } from '@nestjs/common';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';
import { ProductAppClient } from '@cart-app/product-app/product-app.client';
import {
  CartGetDto,
  CartAddItemDto,
  CartUpdateItemDto,
  CartRemoveItemDto,
  CartClearDto,
  CartMergeDto,
} from '@shared/dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartItemService: CartItemService,
    private readonly productClient: ProductAppClient,
  ) {}

  async getOrCreateCart(userId: string) {
    // For user carts, we use userId as sessionId
    const sessionId = `user-${userId}`;

    let cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          sessionId,
          userId,
        },
        include: { items: true },
      });
    }

    return cart;
  }

  async getCartWithProducts(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    if (cart.items.length === 0) {
      return {
        cart,
        totalInt: 0,
        items: [],
      };
    }

    // Batch fetch products
    const productIds = cart.items.map(item => item.productId);
    const products = await this.productClient.getProductsByIds(productIds);

    // Create product map for quick lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    // Enrich items with product data
    const enrichedItems = cart.items.map(item => {
      const product = productMap.get(item.productId);
      return {
        ...item,
        product: product || null, // null if product deleted
      };
    });

    // Calculate total (only for available products)
    const totalInt = enrichedItems.reduce((sum, item) => {
      if (
        item.product &&
        typeof item.product === 'object' &&
        item.product !== null &&
        'priceInt' in item.product
      ) {
        return sum + (item.product as any).priceInt * item.quantity;
      }
      return sum;
    }, 0);

    return {
      cart: { ...cart, items: enrichedItems },
      totalInt,
    };
  }

  async clearCart(userId: string) {
    const sessionId = `user-${userId}`;

    const cart = await this.prisma.cart.findUnique({
      where: { sessionId },
    });

    if (!cart) {
      return { success: true }; // Idempotent
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { success: true };
  }

  async mergeGuestItems(userId: string, guestItems: { productId: string; quantity: number }[]) {
    const cart = await this.getOrCreateCart(userId);

    // Use transaction for consistency
    await this.prisma.$transaction(async tx => {
      for (const guestItem of guestItems) {
        if (guestItem.quantity <= 0) continue; // Skip invalid items

        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: cart.id,
              productId: guestItem.productId,
            },
          },
        });

        if (existing) {
          // Add quantities
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + guestItem.quantity },
          });
        } else {
          // Create new item
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: guestItem.productId,
              quantity: guestItem.quantity,
            },
          });
        }
      }
    });

    return {
      cart: { id: cart.id, itemsCount: cart.items.length },
    };
  }

  // Controller methods
  async get(dto: CartGetDto) {
    return this.getCartWithProducts(dto.userId);
  }

  async addItem(dto: CartAddItemDto) {
    const cart = await this.getOrCreateCart(dto.userId);
    const cartItem = await this.cartItemService.addItem(cart.id, dto.productId, dto.quantity);
    return { cartItem };
  }

  async updateItem(dto: CartUpdateItemDto) {
    const cart = await this.getOrCreateCart(dto.userId);
    const cartItem = await this.cartItemService.updateQuantity(
      cart.id,
      dto.productId,
      dto.quantity,
    );
    return { cartItem };
  }

  async removeItem(dto: CartRemoveItemDto) {
    const cart = await this.getOrCreateCart(dto.userId);
    return this.cartItemService.removeItem(cart.id, dto.productId);
  }

  async clear(dto: CartClearDto) {
    return this.clearCart(dto.userId);
  }

  async merge(dto: CartMergeDto) {
    return this.mergeGuestItems(dto.userId, dto.guestItems);
  }
}
