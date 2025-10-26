import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';
import { EVENTS } from '@shared/events';
import {
  ServiceUnavailableRpcException,
  InternalServerRpcException,
  ValidationRpcException,
  EntityNotFoundRpcException,
} from '@shared/exceptions/rpc-exceptions';
import {
  CartGetDto,
  CartAddItemDto,
  CartUpdateItemDto,
  CartRemoveItemDto,
} from '@shared/dto/cart.dto';
import {
  CartResponse,
  CartWithProductsResponse,
  CartItemOperationResponse,
  CartOperationSuccessResponse,
  ProductData,
  CartItemWithProduct,
  CartItemResponse,
} from '@shared/types/cart.types';

export interface ICartService {
  get(dto: CartGetDto): Promise<CartWithProductsResponse>;
  addItem(dto: CartAddItemDto): Promise<CartItemOperationResponse>;
  updateItem(dto: CartUpdateItemDto): Promise<CartItemOperationResponse>;
  removeItem(dto: CartRemoveItemDto): Promise<CartOperationSuccessResponse>;
}

/**
 * CartService - Quản lý giỏ hàng
 */
@Injectable()
export class CartService implements ICartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartItemService: CartItemService,
    @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
  ) {}

  /**
   * 1. GET - Lấy giỏ hàng với thông tin chi tiết sản phẩm
   */
  async get(dto: CartGetDto): Promise<CartWithProductsResponse> {
    try {
      const cart = await this.getOrCreateCart(dto.userId);

      if (cart.items.length === 0) {
        return {
          cart,
          items: [],
          totalInt: 0,
        };
      }

      const productIds = cart.items.map(item => item.productId);
      const products = await this.fetchProductsByIds(productIds);
      const enrichedItems = this.enrichCartItems(cart.items, products);
      const totalInt = this.calculateTotal(enrichedItems);

      return {
        cart,
        items: enrichedItems,
        totalInt,
      };
    } catch (error) {
      if (
        error instanceof InternalServerRpcException ||
        error instanceof ServiceUnavailableRpcException
      ) {
        throw error;
      }

      console.error('[CartService] get error:', {
        userId: dto.userId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi lấy thông tin giỏ hàng');
    }
  }

  /**
   * 2. ADD - Thêm sản phẩm vào giỏ hàng
   */
  async addItem(dto: CartAddItemDto): Promise<CartItemOperationResponse> {
    try {
      const cart = await this.getOrCreateCart(dto.userId);
      const cartItem = await this.cartItemService.addItem(cart.id, dto.productId, dto.quantity);
      return { cartItem };
    } catch (error) {
      if (error instanceof InternalServerRpcException || error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[CartService] addItem error:', {
        userId: dto.userId,
        productId: dto.productId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi thêm sản phẩm vào giỏ hàng');
    }
  }

  /**
   * 3. UPDATE - Cập nhật số lượng sản phẩm
   */
  async updateItem(dto: CartUpdateItemDto): Promise<CartItemOperationResponse> {
    try {
      const cart = await this.getOrCreateCart(dto.userId);
      const cartItem = await this.cartItemService.updateQuantity(
        cart.id,
        dto.productId,
        dto.quantity,
      );
      return { cartItem };
    } catch (error) {
      if (
        error instanceof InternalServerRpcException ||
        error instanceof ValidationRpcException ||
        error instanceof EntityNotFoundRpcException
      ) {
        throw error;
      }

      console.error('[CartService] updateItem error:', {
        userId: dto.userId,
        productId: dto.productId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi cập nhật sản phẩm trong giỏ hàng');
    }
  }

  /**
   * 4. DELETE - Xóa sản phẩm khỏi giỏ hàng
   */
  async removeItem(dto: CartRemoveItemDto): Promise<CartOperationSuccessResponse> {
    try {
      const cart = await this.getOrCreateCart(dto.userId);
      return this.cartItemService.removeItem(cart.id, dto.productId);
    } catch (error) {
      if (error instanceof InternalServerRpcException || error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[CartService] removeItem error:', {
        userId: dto.userId,
        productId: dto.productId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi xóa sản phẩm khỏi giỏ hàng');
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Lấy hoặc tạo giỏ hàng cho user
   */
  private async getOrCreateCart(userId?: string, sessionId?: string): Promise<CartResponse> {
    try {
      const effectiveSessionId = sessionId || (userId ? `user-${userId}` : undefined);

      if (!effectiveSessionId) {
        throw new ValidationRpcException('Either userId or sessionId must be provided');
      }

      let cart = await this.prisma.cart.findUnique({
        where: { sessionId: effectiveSessionId },
        include: { items: true },
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: {
            sessionId: effectiveSessionId,
            userId: userId || null,
          },
          include: { items: true },
        });
      }

      if (userId && !cart.userId) {
        cart = await this.prisma.cart.update({
          where: { id: cart.id },
          data: { userId },
          include: { items: true },
        });
      }

      return this.toCartResponse(cart);
    } catch (error) {
      console.error('[CartService] getOrCreateCart error:', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi lấy thông tin giỏ hàng');
    }
  }

  /**
   * Fetch thông tin sản phẩm từ Product Service
   */
  private async fetchProductsByIds(productIds: string[]): Promise<ProductData[]> {
    if (productIds.length === 0) return [];

    try {
      const products: unknown = await firstValueFrom(
        this.productClient.send(EVENTS.PRODUCT.GET_BY_IDS, { ids: productIds }).pipe(timeout(5000)),
      );

      if (!Array.isArray(products)) {
        throw new InternalServerRpcException('Invalid products response format');
      }

      return products as ProductData[];
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ServiceUnavailableRpcException('Product service không phản hồi');
      }
      if (
        error instanceof ServiceUnavailableRpcException ||
        error instanceof InternalServerRpcException
      ) {
        throw error;
      }

      console.error('[CartService] fetchProductsByIds error:', {
        productIds,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi lấy thông tin sản phẩm');
    }
  }

  /**
   * Enrich cart items với product data
   */
  private enrichCartItems(
    items: CartItemResponse[],
    products: ProductData[],
  ): CartItemWithProduct[] {
    const productMap = new Map(products.map(p => [p.id, p]));

    return items.map(item => {
      const product = productMap.get(item.productId);

      if (!product) {
        console.warn('[CartService] Product not found:', item.productId);
      }

      return {
        ...item,
        product: product || null,
      };
    });
  }

  /**
   * Tính tổng giá trị giỏ hàng
   */
  private calculateTotal(items: CartItemWithProduct[]): number {
    return items.reduce((sum, item) => {
      if (item.product) {
        return sum + item.product.priceInt * item.quantity;
      }
      return sum;
    }, 0);
  }

  /**
   * Convert Prisma Cart sang CartResponse
   */
  private toCartResponse(cart: {
    id: string;
    sessionId: string;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      cartId: string;
      productId: string;
      quantity: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): CartResponse {
    return {
      id: cart.id,
      sessionId: cart.sessionId,
      userId: cart.userId,
      items: cart.items.map(item => ({
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        quantity: item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
