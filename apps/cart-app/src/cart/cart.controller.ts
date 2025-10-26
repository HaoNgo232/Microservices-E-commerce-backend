import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CartService } from '@cart-app/cart/cart.service';
import { EVENTS } from '@shared/events';
import {
  CartGetDto,
  CartAddItemDto,
  CartUpdateItemDto,
  CartRemoveItemDto,
} from '@shared/dto/cart.dto';

/**
 * CartController - NATS Message Handler cho Cart operations
 *
 * Chỉ giữ lại 4 method CRUD cơ bản:
 * - get: Lấy giỏ hàng
 * - addItem: Thêm sản phẩm
 * - updateItem: Cập nhật số lượng
 * - removeItem: Xóa sản phẩm
 */
@Controller()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Lấy giỏ hàng của user
   * Event: cart.get
   */
  @MessagePattern(EVENTS.CART.GET)
  get(@Payload() dto: CartGetDto) {
    return this.cartService.get(dto);
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   * Event: cart.addItem
   */
  @MessagePattern(EVENTS.CART.ADD_ITEM)
  addItem(@Payload() dto: CartAddItemDto) {
    return this.cartService.addItem(dto);
  }

  /**
   * Cập nhật số lượng sản phẩm
   * Event: cart.updateItem
   */
  @MessagePattern(EVENTS.CART.UPDATE_ITEM)
  updateItem(@Payload() dto: CartUpdateItemDto) {
    return this.cartService.updateItem(dto);
  }

  /**
   * Xóa sản phẩm khỏi giỏ hàng
   * Event: cart.removeItem
   */
  @MessagePattern(EVENTS.CART.REMOVE_ITEM)
  removeItem(@Payload() dto: CartRemoveItemDto) {
    return this.cartService.removeItem(dto);
  }
}
