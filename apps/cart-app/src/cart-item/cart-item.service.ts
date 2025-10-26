import { Injectable } from '@nestjs/common';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import {
  ValidationRpcException,
  EntityNotFoundRpcException,
  InternalServerRpcException,
} from '@shared/exceptions/rpc-exceptions';
import { CartItemResponse } from '@shared/types/cart.types';

export interface ICartItemService {
  addItem(cartId: string, productId: string, quantity: number): Promise<CartItemResponse>;
  updateQuantity(
    cartId: string,
    productId: string,
    quantity: number,
  ): Promise<CartItemResponse | null>;
  removeItem(cartId: string, productId: string): Promise<{ success: boolean }>;
  findByCartAndProduct(cartId: string, productId: string): Promise<CartItemResponse | null>;
}

/**
 * CartItemService - Quản lý các item trong giỏ hàng
 *
 * Responsibilities:
 * - CRUD operations cho CartItem
 * - Basic validation số lượng
 *
 * Note: Product validation được xử lý ở Gateway layer
 * Design Pattern: Repository Pattern
 */
@Injectable()
export class CartItemService implements ICartItemService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Thêm sản phẩm vào giỏ hàng
   * - Nếu sản phẩm đã tồn tại: tăng số lượng
   * - Nếu chưa tồn tại: tạo mới CartItem
   *
   * @param cartId - ID của giỏ hàng
   * @param productId - ID sản phẩm cần thêm
   * @param quantity - Số lượng cần thêm (phải > 0)
   * @throws ValidationRpcException - Nếu quantity <= 0
   * @throws InternalServerRpcException - Lỗi database
   */
  async addItem(cartId: string, productId: string, quantity: number): Promise<CartItemResponse> {
    try {
      if (quantity <= 0) {
        throw new ValidationRpcException('Số lượng phải lớn hơn 0');
      }

      const cartItem = await this.prisma.cartItem.upsert({
        where: {
          cartId_productId: { cartId, productId },
        },
        update: {
          quantity: { increment: quantity },
        },
        create: {
          cartId,
          productId,
          quantity,
        },
      });

      return this.toCartItemResponse(cartItem);
    } catch (error) {
      if (error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[CartItemService] addItem error:', {
        cartId,
        productId,
        quantity,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi thêm sản phẩm vào giỏ hàng');
    }
  }

  /**
   * Cập nhật số lượng sản phẩm trong giỏ hàng
   * - Nếu quantity = 0: xóa item
   * - Nếu quantity > 0: cập nhật số lượng
   *
   * @param cartId - ID của giỏ hàng
   * @param productId - ID sản phẩm cần cập nhật
   * @param quantity - Số lượng mới (>= 0)
   * @throws ValidationRpcException - Nếu quantity < 0
   * @throws EntityNotFoundRpcException - Nếu CartItem không tồn tại
   * @throws InternalServerRpcException - Lỗi database
   */
  async updateQuantity(
    cartId: string,
    productId: string,
    quantity: number,
  ): Promise<CartItemResponse | null> {
    try {
      if (quantity < 0) {
        throw new ValidationRpcException('Số lượng không hợp lệ');
      }

      if (quantity === 0) {
        const deleted = await this.prisma.cartItem.deleteMany({
          where: { cartId, productId },
        });

        if (deleted.count === 0) {
          throw new EntityNotFoundRpcException('CartItem', productId);
        }

        return null;
      }

      const updated = await this.prisma.cartItem.updateMany({
        where: { cartId, productId },
        data: { quantity },
      });

      if (updated.count === 0) {
        throw new EntityNotFoundRpcException('CartItem', productId);
      }

      return this.findByCartAndProduct(cartId, productId);
    } catch (error) {
      if (error instanceof ValidationRpcException || error instanceof EntityNotFoundRpcException) {
        throw error;
      }

      console.error('[CartItemService] updateQuantity error:', {
        cartId,
        productId,
        quantity,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi cập nhật số lượng sản phẩm');
    }
  }

  /**
   * Xóa sản phẩm khỏi giỏ hàng
   *
   * @param cartId - ID của giỏ hàng
   * @param productId - ID sản phẩm cần xóa
   * @throws InternalServerRpcException - Lỗi database
   */
  async removeItem(cartId: string, productId: string): Promise<{ success: boolean }> {
    try {
      await this.prisma.cartItem.deleteMany({
        where: { cartId, productId },
      });

      return { success: true };
    } catch (error) {
      console.error('[CartItemService] removeItem error:', {
        cartId,
        productId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi xóa sản phẩm khỏi giỏ hàng');
    }
  }

  /**
   * Tìm CartItem theo cartId và productId
   *
   * @param cartId - ID của giỏ hàng
   * @param productId - ID sản phẩm
   * @returns CartItem hoặc null nếu không tìm thấy
   * @throws InternalServerRpcException - Lỗi database
   */
  async findByCartAndProduct(cartId: string, productId: string): Promise<CartItemResponse | null> {
    try {
      const cartItem = await this.prisma.cartItem.findUnique({
        where: {
          cartId_productId: { cartId, productId },
        },
      });

      return cartItem ? this.toCartItemResponse(cartItem) : null;
    } catch (error) {
      console.error('[CartItemService] findByCartAndProduct error:', {
        cartId,
        productId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerRpcException('Lỗi khi tìm sản phẩm trong giỏ hàng');
    }
  }

  private toCartItemResponse(item: {
    id: string;
    cartId: string;
    productId: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
  }): CartItemResponse {
    return {
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      quantity: item.quantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
