import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderItemService } from '@order-app/order-item/order-item.service';
import { EVENTS } from '@shared/events';
import { OrderItemListByOrderDto, OrderItemAddDto, OrderItemRemoveDto } from '@shared/dto/order.dto';
import { OrderItemResponse } from '@shared/types/order.types';

/**
 * OrderItemController - NATS Message Handler cho Order Items
 *
 * Xử lý các NATS messages liên quan đến order items:
 * - LIST_BY_ORDER: Lấy danh sách items của order
 * - ADD_ITEM: Thêm item vào order
 * - REMOVE_ITEM: Xóa item khỏi order
 *
 * **Note:** Controller chỉ route messages, business logic ở OrderItemService
 */
@Controller()
export class OrderItemController {
  /**
   * Constructor - Inject OrderItemService
   *
   * @param orderItemService - Service xử lý business logic
   */
  constructor(private readonly orderItemService: OrderItemService) {}

  /**
   * NATS Handler: Lấy danh sách items của order
   *
   * Pattern: orderItem.listByOrder
   * @param dto - { orderId }
   * @returns Danh sách order items
   */
  @MessagePattern(EVENTS.ORDER_ITEM.LIST_BY_ORDER)
  listByOrder(@Payload() dto: OrderItemListByOrderDto): Promise<OrderItemResponse[]> {
    return this.orderItemService.listByOrder(dto);
  }

  /**
   * NATS Handler: Thêm item vào order
   *
   * Pattern: orderItem.addItem
   * @param dto - { orderId, productId, quantity, priceInt }
   * @returns Order item đã tạo
   */
  @MessagePattern(EVENTS.ORDER_ITEM.ADD_ITEM)
  addItem(@Payload() dto: OrderItemAddDto): Promise<OrderItemResponse> {
    return this.orderItemService.addItem(dto);
  }

  /**
   * NATS Handler: Xóa item khỏi order
   *
   * Pattern: orderItem.removeItem
   * @param dto - { id }
   * @returns void
   */
  @MessagePattern(EVENTS.ORDER_ITEM.REMOVE_ITEM)
  removeItem(@Payload() dto: OrderItemRemoveDto): Promise<void> {
    return this.orderItemService.removeItem(dto);
  }
}
