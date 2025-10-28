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

/**
 * OrdersController - NATS Message Handler cho Orders
 *
 * Xử lý các NATS messages liên quan đến orders:
 * - CREATE: Tạo order mới
 * - GET: Lấy chi tiết order
 * - LIST_BY_USER: Lấy danh sách orders của user
 * - UPDATE_STATUS: Cập nhật trạng thái order
 * - CANCEL: Hủy order
 *
 * **Note:** Controller chỉ route messages, business logic ở OrdersService
 */
@Controller()
export class OrdersController {
  /**
   * Constructor - Inject OrdersService
   *
   * @param ordersService - Service xử lý business logic
   */
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * NATS Handler: Tạo order mới
   *
   * Pattern: order.create
   * @param dto - { userId, addressId?, items[] }
   * @returns Order đã tạo với items
   */
  @MessagePattern(EVENTS.ORDER.CREATE)
  create(@Payload() dto: OrderCreateDto): Promise<OrderResponse> {
    return this.ordersService.create(dto);
  }

  /**
   * NATS Handler: Lấy chi tiết order
   *
   * Pattern: order.get
   * @param dto - { id }
   * @returns Order với đầy đủ items
   */
  @MessagePattern(EVENTS.ORDER.GET)
  get(@Payload() dto: OrderIdDto): Promise<OrderResponse> {
    return this.ordersService.get(dto);
  }

  /**
   * NATS Handler: Lấy danh sách orders của user
   *
   * Pattern: order.listByUser
   * @param dto - { userId, page?, pageSize? }
   * @returns Danh sách orders với pagination
   */
  @MessagePattern(EVENTS.ORDER.LIST_BY_USER)
  listByUser(@Payload() dto: OrderListByUserDto): Promise<PaginatedOrdersResponse> {
    return this.ordersService.listByUser(dto);
  }

  /**
   * NATS Handler: Cập nhật trạng thái order
   *
   * Pattern: order.updateStatus
   * @param dto - { id, status }
   * @returns Order với status mới
   */
  @MessagePattern(EVENTS.ORDER.UPDATE_STATUS)
  updateStatus(@Payload() dto: OrderUpdateStatusDto): Promise<OrderResponse> {
    return this.ordersService.updateStatus(dto);
  }

  /**
   * NATS Handler: Hủy order
   *
   * Pattern: order.cancel
   * @param dto - { id, reason? }
   * @returns Order đã hủy
   */
  @MessagePattern(EVENTS.ORDER.CANCEL)
  cancel(@Payload() dto: OrderCancelDto): Promise<OrderResponse> {
    return this.ordersService.cancel(dto);
  }
}
