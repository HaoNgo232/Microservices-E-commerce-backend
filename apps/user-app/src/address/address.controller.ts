import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AddressService } from '@user-app/address/address.service';
import { EVENTS } from '@shared/events';
import {
  AddressCreateDto,
  AddressUpdateDto,
  AddressListByUserDto,
  AddressSetDefaultDto,
} from '@shared/dto/address.dto';
import { AddressResponse } from '@shared/types/address.types';

/**
 * Interface cho Address Controller
 * Định nghĩa các phương thức quản lý shipping addresses
 */
export interface IAddressController {
  /**
   * Lấy danh sách addresses của user
   */
  listByUser(dto: AddressListByUserDto): Promise<AddressResponse[]>;

  /**
   * Tạo address mới
   */
  create(payload: { userId: string; dto: AddressCreateDto }): Promise<AddressResponse>;

  /**
   * Cập nhật address
   */
  update(payload: { id: string; dto: AddressUpdateDto }): Promise<AddressResponse>;

  /**
   * Xóa address
   */
  delete(id: string): Promise<{ success: boolean; message: string }>;

  /**
   * Đặt address làm mặc định
   */
  setDefault(dto: AddressSetDefaultDto): Promise<AddressResponse>;
}

/**
 * AddressController - NATS Message Handler cho Addresses
 *
 * Xử lý các NATS messages liên quan đến shipping addresses:
 * - LIST_BY_USER: Lấy danh sách addresses của user
 * - CREATE: Tạo address mới (tự động set default nếu là địa chỉ đầu tiên)
 * - UPDATE: Cập nhật address
 * - DELETE: Xóa address (auto-assign default mới nếu xóa default)
 * - SET_DEFAULT: Đặt address làm mặc định
 *
 * **Note:** Controller chỉ route messages, business logic ở AddressService
 */
@Controller()
export class AddressController implements IAddressController {
  constructor(private readonly addressService: AddressService) {}

  /**
   * NATS Handler: Lấy danh sách addresses của user
   *
   * Pattern: address.listByUser
   * @param dto - AddressListByUserDto
   * @returns Danh sách addresses (default lên đầu, sau đó sắp xếp theo createdAt desc)
   */
  @MessagePattern(EVENTS.ADDRESS.LIST_BY_USER)
  listByUser(@Payload() dto: AddressListByUserDto): Promise<AddressResponse[]> {
    console.log('AddressController.listByUser called with dto:', dto);
    return this.addressService.listByUser(dto);
  }

  /**
   * NATS Handler: Tạo address mới
   *
   * Pattern: address.create
   * @param payload - { userId, dto }
   * @returns Address đã tạo (tự động set default nếu là địa chỉ đầu tiên)
   */
  @MessagePattern(EVENTS.ADDRESS.CREATE)
  create(@Payload() payload: { userId: string; dto: AddressCreateDto }): Promise<AddressResponse> {
    return this.addressService.create(payload);
  }

  /**
   * NATS Handler: Cập nhật address
   *
   * Pattern: address.update
   * @param payload - { id, dto }
   * @returns Address đã cập nhật
   */
  @MessagePattern(EVENTS.ADDRESS.UPDATE)
  update(@Payload() payload: { id: string; dto: AddressUpdateDto }): Promise<AddressResponse> {
    console.log('AddressController.update called with payload:', payload);
    return this.addressService.update(payload.id, payload.dto);
  }

  /**
   * NATS Handler: Xóa address
   *
   * Pattern: address.delete
   * @param id - Address ID
   * @returns Success message
   */
  @MessagePattern(EVENTS.ADDRESS.DELETE)
  delete(@Payload() id: string): Promise<{ success: boolean; message: string }> {
    return this.addressService.delete(id);
  }

  /**
   * NATS Handler: Đặt address làm mặc định
   *
   * Pattern: address.setDefault
   * @param dto - { userId, addressId }
   * @returns Address đã set làm default
   */
  @MessagePattern(EVENTS.ADDRESS.SET_DEFAULT)
  setDefault(@Payload() dto: AddressSetDefaultDto): Promise<AddressResponse> {
    return this.addressService.setDefaultAddress(dto);
  }
}
