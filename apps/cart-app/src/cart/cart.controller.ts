import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CartService } from '@cart-app/cart/cart.service';
import { EVENTS } from '@shared/events';
import { CartGetDto, CartAddItemDto, CartUpdateItemDto, CartRemoveItemDto } from '@shared/dto/cart.dto';
import { CartOperationSuccessResponse, CartWithProductsResponse } from '@shared/types';

/**
 * CartController - NATS Message Handler cho Cart operations
 */
@Controller()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Lấy giỏ hàng của user
   * Event: cart.get
   */
  @MessagePattern(EVENTS.CART.GET)
  get(@Payload() dto: CartGetDto): Promise<CartWithProductsResponse> {
    return this.cartService.get(dto);
  }

  /**
   * Thêm sản phẩm vào giỏ hàng, trả về giỏ hàng đầy đủ
   * Event: cart.addItem
   */
  @MessagePattern(EVENTS.CART.ADD_ITEM)
  addItem(@Payload() dto: CartAddItemDto): Promise<CartWithProductsResponse> {
    return this.cartService.addItem(dto);
  }

  /**
   * Cập nhật số lượng sản phẩm, trả về giỏ hàng đầy đủ
   * Event: cart.updateItem
   */
  @MessagePattern(EVENTS.CART.UPDATE_ITEM)
  updateItem(@Payload() dto: CartUpdateItemDto): Promise<CartWithProductsResponse> {
    return this.cartService.updateItem(dto);
  }

  /**
   * Xóa sản phẩm khỏi giỏ hàng, trả về giỏ hàng đầy đủ
   * Event: cart.removeItem
   */
  @MessagePattern(EVENTS.CART.REMOVE_ITEM)
  async removeItem(@Payload() dto: CartRemoveItemDto): Promise<CartWithProductsResponse> {
    await this.cartService.removeItem(dto);
    // Return full cart
    return this.cartService.get({ userId: dto.userId });
  }

  /**
   * Clear all items from user's cart
   * Called when order is created successfully
   * Event: cart.clear
   */
  @MessagePattern(EVENTS.CART.CLEAR)
  clear(@Payload() dto: CartGetDto): Promise<CartOperationSuccessResponse> {
    return this.cartService.clear(dto.userId);
  }
}
