import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';
import { EVENTS } from '@shared/events';
import { ServiceUnavailableRpcException } from '@shared/exceptions/rpc-exceptions';
import {
  CartGetDto,
  CartAddItemDto,
  CartUpdateItemDto,
  CartRemoveItemDto,
  CartClearDto,
  CartMergeDto,
} from '@shared/dto/cart.dto';
import { Cart, CartItem } from '@cart-app/prisma/generated/client';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartItemService: CartItemService,
    @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
  ) {}

  async getOrCreateCart(userId: string): Promise<Cart> {
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

  async getCartWithProducts(
    userId: string,
  ): Promise<{ cart: Cart; totalInt: number; items: Array<CartItem> }> {
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
    const products = await this.fetchProductsByIds(productIds);

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
        return sum + (item.product as { priceInt: number }).priceInt * item.quantity;
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

  /**
   * Fetch multiple products from product-service
   * @private
   */
  private async fetchProductsByIds(
    productIds: string[],
  ): Promise<Array<{ id: string; priceInt: number }>> {
    if (productIds.length === 0) return [];

    try {
      const products = await firstValueFrom(
        this.productClient.send(EVENTS.PRODUCT.GET_BY_IDS, { ids: productIds }).pipe(timeout(5000)),
      );
      return products as Array<{ id: string; priceInt: number }>;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ServiceUnavailableRpcException('Product service không phản hồi');
      }
      throw error;
    }
  }
}
