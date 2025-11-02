import { Controller, Get, Post, Patch, Delete, Body, Inject, UseGuards, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '@gateway/auth/auth.guard';
import { CartGetDto, CartAddItemDto, CartUpdateItemDto, CartRemoveItemDto } from '@shared/dto/cart.dto';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { CartWithProductsResponse } from '@shared/types';

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
   * userId được extract từ JWT token (req.user.userId)
   */
  @Get()
  get(@Req() req: Request & { user: { userId: string } }): Promise<CartWithProductsResponse> {
    const dto: CartGetDto = {
      userId: req.user.userId,
    };
    return this.send<CartGetDto, CartWithProductsResponse>(EVENTS.CART.GET, dto);
  }

  /**
   * POST /cart/items
   * Thêm sản phẩm vào giỏ hàng
   */
  @Post('items')
  addItem(
    @Body() dto: CartAddItemDto,
    @Req() req: Request & { user: { userId: string } },
  ): Promise<CartWithProductsResponse> {
    return this.send<CartAddItemDto, CartWithProductsResponse>(EVENTS.CART.ADD_ITEM, {
      ...dto,
      userId: req.user.userId,
    });
  }

  /**
   * PATCH /cart/items
   * Cập nhật số lượng sản phẩm trong giỏ hàng
   */
  @Patch('items')
  updateItem(
    @Body() dto: CartUpdateItemDto,
    @Req() req: Request & { user: { userId: string } },
  ): Promise<CartWithProductsResponse> {
    return this.send<CartUpdateItemDto, CartWithProductsResponse>(EVENTS.CART.UPDATE_ITEM, {
      ...dto,
      userId: req.user.userId,
    });
  }

  /**
   * DELETE /cart/items
   * Xóa sản phẩm khỏi giỏ hàng
   */
  @Delete('items')
  removeItem(
    @Body() dto: CartRemoveItemDto,
    @Req() req: Request & { user: { userId: string } },
  ): Promise<CartWithProductsResponse> {
    return this.send<CartRemoveItemDto, CartWithProductsResponse>(EVENTS.CART.REMOVE_ITEM, {
      ...dto,
      userId: req.user.userId,
    });
  }
}
