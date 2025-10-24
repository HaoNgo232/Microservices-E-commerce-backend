import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CartService } from '@cart-app/cart/cart.service';
import { EVENTS } from '@shared/events';
import { InternalServerRpcException } from '@shared/exceptions/rpc-exceptions';
import {
  CartGetDto,
  CartAddItemDto,
  CartUpdateItemDto,
  CartRemoveItemDto,
  CartClearDto,
  CartMergeDto,
} from '@shared/dto/cart.dto';

@Controller()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @MessagePattern(EVENTS.CART.GET)
  async get(@Payload() dto: CartGetDto) {
    try {
      return await this.cartService.get(dto);
    } catch (error) {
      console.error('[CartController] get error:', {
        userId: dto.userId,
        error: error.message,
      });

      if (error instanceof RpcException) {
        throw error;
      }

      throw new InternalServerRpcException('Lỗi lấy thông tin giỏ hàng');
    }
  }

  @MessagePattern(EVENTS.CART.ADD_ITEM)
  async addItem(@Payload() dto: CartAddItemDto) {
    try {
      return await this.cartService.addItem(dto);
    } catch (error) {
      console.error('[CartController] addItem error:', {
        userId: dto.userId,
        productId: dto.productId,
        error: error.message,
      });

      if (error instanceof RpcException) {
        throw error;
      }

      throw new InternalServerRpcException('Lỗi thêm sản phẩm vào giỏ hàng');
    }
  }

  @MessagePattern(EVENTS.CART.UPDATE_ITEM)
  async updateItem(@Payload() dto: CartUpdateItemDto) {
    try {
      return await this.cartService.updateItem(dto);
    } catch (error) {
      console.error('[CartController] updateItem error:', {
        userId: dto.userId,
        productId: dto.productId,
        error: error.message,
      });

      if (error instanceof RpcException) {
        throw error;
      }

      throw new InternalServerRpcException('Lỗi cập nhật sản phẩm trong giỏ hàng');
    }
  }

  @MessagePattern(EVENTS.CART.REMOVE_ITEM)
  async removeItem(@Payload() dto: CartRemoveItemDto) {
    try {
      return await this.cartService.removeItem(dto);
    } catch (error) {
      console.error('[CartController] removeItem error:', {
        userId: dto.userId,
        productId: dto.productId,
        error: error.message,
      });

      if (error instanceof RpcException) {
        throw error;
      }

      throw new InternalServerRpcException('Lỗi xóa sản phẩm khỏi giỏ hàng');
    }
  }

  @MessagePattern(EVENTS.CART.CLEAR)
  async clear(@Payload() dto: CartClearDto) {
    try {
      return await this.cartService.clear(dto);
    } catch (error) {
      console.error('[CartController] clear error:', {
        userId: dto.userId,
        error: error.message,
      });

      if (error instanceof RpcException) {
        throw error;
      }

      throw new InternalServerRpcException('Lỗi xóa giỏ hàng');
    }
  }

  @MessagePattern(EVENTS.CART.MERGE)
  async merge(@Payload() dto: CartMergeDto) {
    try {
      return await this.cartService.merge(dto);
    } catch (error) {
      console.error('[CartController] merge error:', {
        userId: dto.userId,
        guestItemsCount: dto.guestItems.length,
        error: error.message,
      });

      if (error instanceof RpcException) {
        throw error;
      }

      throw new InternalServerRpcException('Lỗi merge giỏ hàng guest');
    }
  }
}
