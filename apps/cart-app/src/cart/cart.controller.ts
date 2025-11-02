import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CartService } from '@cart-app/cart/cart.service';
import { EVENTS } from '@shared/events';
import { CartGetDto, CartAddItemDto, CartUpdateItemDto, CartRemoveItemDto } from '@shared/dto/cart.dto';
import { CartItemOperationResponse, CartOperationSuccessResponse, CartWithProductsResponse } from '@shared/types';

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
   * Thêm sản phẩm vào giỏ hàng
   * Event: cart.addItem
   */
  @MessagePattern(EVENTS.CART.ADD_ITEM)
  addItem(@Payload() dto: CartAddItemDto): Promise<CartItemOperationResponse> {
    return this.cartService.addItem(dto);
  }

  /**
   * Cập nhật số lượng sản phẩm
   * Event: cart.updateItem
   */
  @MessagePattern(EVENTS.CART.UPDATE_ITEM)
  updateItem(@Payload() dto: CartUpdateItemDto): Promise<CartItemOperationResponse> {
    return this.cartService.updateItem(dto);
  }

  /**
   * Xóa sản phẩm khỏi giỏ hàng
   * Event: cart.removeItem
   */
  @MessagePattern(EVENTS.CART.REMOVE_ITEM)
  removeItem(@Payload() dto: CartRemoveItemDto): Promise<CartOperationSuccessResponse> {
    return this.cartService.removeItem(dto);
  }
}
