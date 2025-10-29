import { Controller, Get, Post, Patch, Delete, Body, Inject, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '@gateway/auth/auth.guard';
import {
  CartGetDto,
  CartAddItemDto,
  CartUpdateItemDto,
  CartRemoveItemDto,
} from '@shared/dto/cart.dto';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import {
  CartWithProductsResponse,
  CartItemOperationResponse,
  CartOperationSuccessResponse,
} from '@shared/types';

/**
 * Cart Controller - Gateway endpoint cho shopping cart
 * Forward requests đến cart-service qua NATS messaging
 *
 * **Security**: Tất cả endpoints require authentication
 * userId được extract từ JWT token để đảm bảo users chỉ access được cart của mình
 */
@Controller('cart')
@UseGuards(AuthGuard)
export class CartController extends BaseGatewayController {
  constructor(@Inject('CART_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * GET /cart
   * Lấy giỏ hàng của user với thông tin chi tiết sản phẩm
   *
   * Pattern: Extract userId từ JWT token (SECURITY: không tin query params)
   * Gateway gửi: CartGetDto (với userId từ JWT)
   * Microservice nhận: CartGetDto
   */
  @Get()
  get(@Body() dto: CartGetDto): Promise<CartWithProductsResponse> {
    return this.send<CartGetDto, CartWithProductsResponse>(EVENTS.CART.GET, dto);
  }

  /**
   * POST /cart/items
   * Thêm sản phẩm vào giỏ hàng
   *
   * Pattern: Extract userId từ JWT token
   * Gateway gửi: CartAddItemDto (với userId từ JWT)
   * Microservice nhận: CartAddItemDto
   */
  @Post('items')
  addItem(@Body() dto: CartAddItemDto): Promise<CartItemOperationResponse> {
    return this.send<CartAddItemDto, CartItemOperationResponse>(EVENTS.CART.ADD_ITEM, dto);
  }

  /**
   * PATCH /cart/items
   * Cập nhật số lượng sản phẩm trong giỏ hàng
   *
   * Pattern: Extract userId từ JWT token
   * Gateway gửi: CartUpdateItemDto (với userId từ JWT)
   * Microservice nhận: CartUpdateItemDto
   */
  @Patch('items')
  updateItem(@Body() dto: CartUpdateItemDto): Promise<CartItemOperationResponse> {
    return this.send<CartUpdateItemDto, CartItemOperationResponse>(EVENTS.CART.UPDATE_ITEM, dto);
  }

  /**
   * DELETE /cart/items
   * Xóa sản phẩm khỏi giỏ hàng
   *
   * Pattern: Extract userId từ JWT token
   * Gateway gửi: CartRemoveItemDto (với userId từ JWT)
   * Microservice nhận: CartRemoveItemDto
   */
  @Delete('items')
  removeItem(@Body() dto: CartRemoveItemDto): Promise<CartOperationSuccessResponse> {
    return this.send<CartRemoveItemDto, CartOperationSuccessResponse>(EVENTS.CART.REMOVE_ITEM, dto);
  }
}
