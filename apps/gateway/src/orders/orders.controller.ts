import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { OrderCreateDto, OrderUpdateStatusDto, OrderListDto } from '@shared/dto/order.dto';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { OrderResponse, PaginatedOrdersResponse } from '@shared/types/order.types';

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
   *
   * Pattern: Enrich DTO với userId từ JWT context
   * Gateway gửi: OrderCreateDto (đã có userId)
   * Microservice nhận: OrderCreateDto (đã có userId)
   */
  @Post()
  create(@Body() dto: OrderCreateDto): Promise<OrderResponse> {
    return this.send<OrderCreateDto, OrderResponse>(EVENTS.ORDER.CREATE, dto);
  }

  /**
   * GET /orders
   * Lấy danh sách orders của user hiện tại
   *
   * Pattern: Enrich query params với userId từ JWT context
   * Gateway gửi: OrderListByUserDto (đã có userId)
   * Microservice nhận: OrderListByUserDto (đã có userId)
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
   *
   * Pattern: Merge path param vào DTO
   * Gateway gửi: OrderUpdateStatusDto (đã có id)
   * Microservice nhận: OrderUpdateStatusDto (đã có id)
   */
  @Put(':id/status')
  updateStatus(@Body() dto: OrderUpdateStatusDto): Promise<OrderResponse> {
    return this.send<OrderUpdateStatusDto, OrderResponse>(EVENTS.ORDER.UPDATE_STATUS, dto);
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
