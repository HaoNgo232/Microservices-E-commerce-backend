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

export interface IAddressController {
  listByUser(dto: AddressListByUserDto): Promise<AddressResponse[]>;
  create(payload: { userId: string; dto: AddressCreateDto }): Promise<AddressResponse>;
  update(payload: { id: string; dto: AddressUpdateDto }): Promise<AddressResponse>;
  delete(id: string): Promise<{ success: boolean; message: string }>;
  setDefault(dto: AddressSetDefaultDto): Promise<AddressResponse>;
}

@Controller()
export class AddressController implements IAddressController {
  constructor(private readonly addressService: AddressService) {}

  @MessagePattern(EVENTS.ADDRESS.LIST_BY_USER)
  listByUser(@Payload() dto: AddressListByUserDto): Promise<AddressResponse[]> {
    return this.addressService.listByUser(dto);
  }

  @MessagePattern(EVENTS.ADDRESS.CREATE)
  create(@Payload() payload: { userId: string; dto: AddressCreateDto }): Promise<AddressResponse> {
    return this.addressService.create(payload);
  }

  @MessagePattern(EVENTS.ADDRESS.UPDATE)
  update(@Payload() payload: { id: string; dto: AddressUpdateDto }): Promise<AddressResponse> {
    return this.addressService.update(payload.id, payload.dto);
  }

  @MessagePattern(EVENTS.ADDRESS.DELETE)
  delete(@Payload() id: string): Promise<{ success: boolean; message: string }> {
    return this.addressService.delete(id);
  }

  @MessagePattern(EVENTS.ADDRESS.SET_DEFAULT)
  setDefault(@Payload() dto: AddressSetDefaultDto): Promise<AddressResponse> {
    return this.addressService.setDefaultAddress(dto);
  }
}
