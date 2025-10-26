import { Controller, Get, Post, Patch, Delete, Body, Query, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
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
 */
@Controller('cart')
export class CartController extends BaseGatewayController {
  constructor(@Inject('CART_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * GET /cart
   * Lấy giỏ hàng của user với thông tin chi tiết sản phẩm
   * Event: cart.get
   */
  @Get()
  async get(@Query() dto: CartGetDto): Promise<CartWithProductsResponse> {
    return await this.send<CartGetDto, CartWithProductsResponse>(EVENTS.CART.GET, dto);
  }

  /**
   * POST /cart/items
   * Thêm sản phẩm vào giỏ hàng
   * Event: cart.addItem
   */
  @Post('items')
  async addItem(@Body() dto: CartAddItemDto): Promise<CartItemOperationResponse> {
    return await this.send<CartAddItemDto, CartItemOperationResponse>(EVENTS.CART.ADD_ITEM, dto);
  }

  /**
   * PATCH /cart/items
   * Cập nhật số lượng sản phẩm trong giỏ hàng
   * Event: cart.updateItem
   */
  @Patch('items')
  async updateItem(@Body() dto: CartUpdateItemDto): Promise<CartItemOperationResponse> {
    return await this.send<CartUpdateItemDto, CartItemOperationResponse>(
      EVENTS.CART.UPDATE_ITEM,
      dto,
    );
  }

  /**
   * DELETE /cart/items
   * Xóa sản phẩm khỏi giỏ hàng
   * Event: cart.removeItem
   */
  @Delete('items')
  async removeItem(@Body() dto: CartRemoveItemDto): Promise<CartOperationSuccessResponse> {
    return await this.send<CartRemoveItemDto, CartOperationSuccessResponse>(
      EVENTS.CART.REMOVE_ITEM,
      dto,
    );
  }
}
