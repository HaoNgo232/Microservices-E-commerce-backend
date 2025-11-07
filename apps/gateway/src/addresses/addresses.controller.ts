import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AddressCreateDto,
  AddressListByUserDto,
  AddressSetDefaultDto,
  AddressUpdateDto,
} from '@shared/dto/address.dto';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { AddressResponse } from '@shared/types/address.types';
import { SuccessResponse } from '@shared/types/response.types';

/**
 * Addresses Controller
 * Gateway endpoint cho shipping addresses - forward requests đến user-service
 * Tất cả endpoints require authentication
 */
@Controller('addresses')
@UseGuards(AuthGuard)
export class AddressesController extends BaseGatewayController {
  constructor(@Inject('USER_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * GET /addresses
   * Lấy danh sách addresses của user hiện tại
   *
   * Pattern: Build DTO từ JWT context
   * Gateway gửi: AddressListByUserDto
   * Microservice nhận: AddressListByUserDto
   */
  @Get()
  list(@Req() req: Request & { user: { userId: string } }): Promise<AddressResponse[]> {
    const payload: AddressListByUserDto = {
      userId: req.user.userId,
    };

    return this.send<AddressListByUserDto, AddressResponse[]>(EVENTS.ADDRESS.LIST_BY_USER, payload);
  }

  /**
   * GET /addresses/:id
   * Lấy chi tiết address theo ID
   */
  @Get(':id')
  getById(@Param('id') id: string): Promise<AddressResponse> {
    return this.send<string, AddressResponse>(EVENTS.ADDRESS.GET, id);
  }

  /**
   * POST /addresses
   * Tạo address mới
   *
   * Pattern: Extract userId từ JWT token và gán vào DTO
   * Gateway gửi: AddressCreateDto + userId context
   * Microservice nhận: { userId: string; dto: AddressCreateDto }
   */
  @Post()
  create(@Req() req: Request & { user: { userId: string } }, @Body() dto: AddressCreateDto): Promise<AddressResponse> {
    // IMPORTANT: Extract userId from JWT token, NOT from request body
    // This prevents security vulnerability where users could create addresses for other users
    const payload = {
      userId: req.user.userId,
      dto,
    };

    return this.send<typeof payload, AddressResponse>(EVENTS.ADDRESS.CREATE, payload);
  }

  /**
   * PUT /addresses/:id
   * Cập nhật address
   *
   * Pattern: Combine path param + body DTO into single payload
   * Gateway gửi: { id: string; dto: AddressUpdateDto }
   * Microservice nhận: { id: string; dto: AddressUpdateDto }
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: AddressUpdateDto): Promise<AddressResponse> {
    const payload = { id, dto };

    return this.send<typeof payload, AddressResponse>(EVENTS.ADDRESS.UPDATE, payload);
  }

  /**
   * DELETE /addresses/:id
   * Xóa address
   */
  @Delete(':id')
  delete(@Param('id') id: string): Promise<SuccessResponse> {
    return this.send<string, SuccessResponse>(EVENTS.ADDRESS.DELETE, id);
  }

  /**
   * PUT /addresses/:id/set-default
   * Đặt address làm default shipping address
   *
   * Pattern: Build DTO từ JWT context + path param
   * Gateway gửi: AddressSetDefaultDto
   * Microservice nhận: AddressSetDefaultDto
   */
  @Put(':id/set-default')
  setDefault(@Req() req: Request & { user: { userId: string } }, @Param('id') id: string): Promise<AddressResponse> {
    const payload: AddressSetDefaultDto = {
      userId: req.user.userId,
      addressId: id,
    };

    return this.send<AddressSetDefaultDto, AddressResponse>(EVENTS.ADDRESS.SET_DEFAULT, payload);
  }
}
