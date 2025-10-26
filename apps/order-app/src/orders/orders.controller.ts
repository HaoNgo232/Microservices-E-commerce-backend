import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from '@order-app/orders/orders.service';
import { EVENTS } from '@shared/events';
import {
  OrderCreateDto,
  OrderIdDto,
  OrderListByUserDto,
  OrderUpdateStatusDto,
  OrderCancelDto,
} from '@shared/dto/order.dto';
import { OrderResponse, PaginatedOrdersResponse } from '@shared/types/order.types';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern(EVENTS.ORDER.CREATE)
  create(@Payload() dto: OrderCreateDto): Promise<OrderResponse> {
    return this.ordersService.create(dto);
  }

  @MessagePattern(EVENTS.ORDER.GET)
  get(@Payload() dto: OrderIdDto): Promise<OrderResponse> {
    return this.ordersService.get(dto);
  }

  @MessagePattern(EVENTS.ORDER.LIST_BY_USER)
  listByUser(@Payload() dto: OrderListByUserDto): Promise<PaginatedOrdersResponse> {
    return this.ordersService.listByUser(dto);
  }

  @MessagePattern(EVENTS.ORDER.UPDATE_STATUS)
  updateStatus(@Payload() dto: OrderUpdateStatusDto): Promise<OrderResponse> {
    return this.ordersService.updateStatus(dto);
  }

  @MessagePattern(EVENTS.ORDER.CANCEL)
  cancel(@Payload() dto: OrderCancelDto): Promise<OrderResponse> {
    return this.ordersService.cancel(dto);
  }
}
