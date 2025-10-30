import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { OrderCreateDto, OrderUpdateStatusDto, OrderListDto } from '@shared/dto/order.dto';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { OrderResponse, OrderStatus, PaginatedOrdersResponse } from '@shared/types/order.types';

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
  create(@Body() dto: OrderCreateDto): Promise<OrderResponse> {
    return this.send<OrderCreateDto, OrderResponse>(EVENTS.ORDER.CREATE, dto);
  }

  /**
   * GET /orders
   * Lấy danh sách orders của user hiện tại
   */
  @Get()
  list(@Query() query: OrderListDto): Promise<PaginatedOrdersResponse> {
    return this.send<OrderListDto, PaginatedOrdersResponse>(EVENTS.ORDER.LIST, query);
  }

  /**
   * GET /orders/:id
   * Lấy chi tiết order theo ID
   */
  @Get(':id')
  findById(@Param('id') id: string): Promise<OrderResponse> {
    return this.send<string, OrderResponse>(EVENTS.ORDER.GET, id);
  }

  /**
   * PUT /orders/:id/status
   * Cập nhật trạng thái order (admin only)
   */
  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: { status: string }): Promise<OrderResponse> {
    const payload: OrderUpdateStatusDto = {
      id,
      status: dto.status as OrderStatus,
    };
    return this.send<OrderUpdateStatusDto, OrderResponse>(EVENTS.ORDER.UPDATE_STATUS, payload);
  }

  /**
   * PUT /orders/:id/cancel
   * Hủy order
   */
  @Put(':id/cancel')
  cancel(@Param('id') id: string): Promise<OrderResponse> {
    return this.send<string, OrderResponse>(EVENTS.ORDER.CANCEL, id);
  }
}
