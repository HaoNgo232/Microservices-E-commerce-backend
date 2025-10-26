import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { OrderCreateDto, OrderUpdateStatusDto, OrderListByUserDto } from '@shared/dto/order.dto';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import {
  OrderResponse,
  PaginatedOrdersResponse,
  OrderStatusUpdateResponse,
} from '@shared/types/order.types';

/**
 * Orders Controller
 * Gateway endpoint cho orders - forward requests đến order-service
 * Tất cả endpoints require authentication
 */
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController extends BaseGatewayController {
  constructor(@Inject('ORDER_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * POST /orders
   * Tạo order mới từ cart
   */
  @Post()
  async create(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: OrderCreateDto,
  ): Promise<OrderResponse> {
    return await this.send<OrderCreateDto & { userId: string }, OrderResponse>(
      EVENTS.ORDER.CREATE,
      {
        ...dto,
        userId: req.user.userId,
      },
    );
  }

  /**
   * GET /orders
   * Lấy danh sách orders của user hiện tại
   */
  @Get()
  async list(
    @Req() req: Request & { user: { userId: string } },
    @Query() query: OrderListByUserDto,
  ): Promise<PaginatedOrdersResponse> {
    return await this.send<OrderListByUserDto & { userId: string }, PaginatedOrdersResponse>(
      EVENTS.ORDER.LIST_BY_USER,
      {
        ...query,
        userId: req.user.userId,
      },
    );
  }

  /**
   * GET /orders/:id
   * Lấy chi tiết order theo ID
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<OrderResponse> {
    return await this.send<string, OrderResponse>(EVENTS.ORDER.GET, id);
  }

  /**
   * PUT /orders/:id/status
   * Cập nhật trạng thái order (admin only)
   */
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: OrderUpdateStatusDto,
  ): Promise<OrderStatusUpdateResponse> {
    return await this.send<OrderUpdateStatusDto & { id: string }, OrderStatusUpdateResponse>(
      EVENTS.ORDER.UPDATE_STATUS,
      { ...dto, id },
    );
  }

  /**
   * PUT /orders/:id/cancel
   * Hủy order
   */
  @Put(':id/cancel')
  async cancel(@Param('id') id: string): Promise<OrderResponse> {
    return await this.send<string, OrderResponse>(EVENTS.ORDER.CANCEL, id);
  }
}
