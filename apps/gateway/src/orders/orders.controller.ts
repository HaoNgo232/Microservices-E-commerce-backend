import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  OrderCreateDto,
  OrderUpdateStatusDto,
  OrderUpdateStatusRequestDto,
  OrderListDto,
  OrderAdminListDto,
} from '@shared/dto/order.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@shared/dto/user.dto';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { OrderResponse, PaginatedOrdersResponse } from '@shared/types/order.types';

/**
 * Orders Controller
 * Gateway endpoint cho orders - forward requests đến order-service
 * Tất cả endpoints require authentication
 */
@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
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
   * GET /orders/admin/all
   * Lấy tất cả orders (admin only) với filters
   */
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  list_all(@Query() query: OrderAdminListDto): Promise<PaginatedOrdersResponse> {
    return this.send<OrderAdminListDto, PaginatedOrdersResponse>(EVENTS.ORDER.LIST_ALL, query);
  }

  /**
   * GET /orders/:id
   * Lấy chi tiết order theo ID
   */
  @Get(':id')
  findById(@Param('id') id: string): Promise<OrderResponse> {
    const payload = { id };
    return this.send<typeof payload, OrderResponse>(EVENTS.ORDER.GET, payload);
  }

  /**
   * PATCH /orders/:id/status
   * Cập nhật trạng thái order (admin only)
   *
   * Note: ValidationPipe với transform: true đảm bảo dto đã được validate và transform
   * TypeScript không thể infer type từ decorator tại compile time, nhưng runtime đã được đảm bảo
   */
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: OrderUpdateStatusRequestDto): Promise<OrderResponse> {
    // Debug: Log để kiểm tra dto nhận được
    console.log('[OrdersController] updateStatus - Received DTO:', JSON.stringify(dto));
    console.log(
      '[OrdersController] updateStatus - DTO type:',
      typeof dto,
      'status:',
      dto.status,
      'paymentStatus:',
      dto.paymentStatus,
    );

    const payload: OrderUpdateStatusDto = {
      id,
      status: dto.status,
    };

    if (dto.paymentStatus !== undefined) {
      payload.paymentStatus = dto.paymentStatus;
    }

    return this.send<OrderUpdateStatusDto, OrderResponse>(EVENTS.ORDER.UPDATE_STATUS, payload);
  }

  /**
   * PUT /orders/:id/cancel
   * Hủy order
   */
  @Put(':id/cancel')
  cancel(@Param('id') id: string): Promise<OrderResponse> {
    const payload = { id };
    return this.send<typeof payload, OrderResponse>(EVENTS.ORDER.CANCEL, payload);
  }
}
