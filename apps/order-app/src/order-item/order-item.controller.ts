import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderItemService } from '@order-app/order-item/order-item.service';
import { EVENTS } from '@shared/events';
import {
  OrderItemListByOrderDto,
  OrderItemAddDto,
  OrderItemRemoveDto,
} from '@shared/dto/order.dto';
import { OrderItemResponse } from '@shared/types/order.types';

@Controller()
export class OrderItemController {
  constructor(private readonly orderItemService: OrderItemService) {}

  @MessagePattern(EVENTS.ORDER_ITEM.LIST_BY_ORDER)
  listByOrder(@Payload() dto: OrderItemListByOrderDto): Promise<OrderItemResponse[]> {
    return this.orderItemService.listByOrder(dto);
  }

  @MessagePattern(EVENTS.ORDER_ITEM.ADD_ITEM)
  addItem(@Payload() dto: OrderItemAddDto): Promise<OrderItemResponse> {
    return this.orderItemService.addItem(dto);
  }

  @MessagePattern(EVENTS.ORDER_ITEM.REMOVE_ITEM)
  removeItem(@Payload() dto: OrderItemRemoveDto): Promise<void> {
    return this.orderItemService.removeItem(dto);
  }
}
