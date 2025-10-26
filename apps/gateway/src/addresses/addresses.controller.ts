import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AddressCreateDto, AddressUpdateDto } from '@shared/dto/address.dto';
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
   */
  @Get()
  async list(@Req() req: Request & { user: { userId: string } }): Promise<AddressResponse[]> {
    return await this.send<string, AddressResponse[]>(EVENTS.ADDRESS.LIST_BY_USER, req.user.userId);
  }

  /**
   * POST /addresses
   * Tạo address mới
   */
  @Post()
  async create(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: AddressCreateDto,
  ): Promise<AddressResponse> {
    return await this.send<AddressCreateDto & { userId: string }, AddressResponse>(
      EVENTS.ADDRESS.CREATE,
      { ...dto, userId: req.user.userId },
    );
  }

  /**
   * PUT /addresses/:id
   * Cập nhật address
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: AddressUpdateDto): Promise<AddressResponse> {
    return await this.send<AddressUpdateDto & { id: string }, AddressResponse>(
      EVENTS.ADDRESS.UPDATE,
      {
        id,
        ...dto,
      },
    );
  }

  /**
   * DELETE /addresses/:id
   * Xóa address
   */
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<SuccessResponse> {
    return await this.send<string, SuccessResponse>(EVENTS.ADDRESS.DELETE, id);
  }

  /**
   * PUT /addresses/:id/set-default
   * Đặt address làm default shipping address
   */
  @Put(':id/set-default')
  async setDefault(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
  ): Promise<AddressResponse> {
    return await this.send<{ userId: string; addressId: string }, AddressResponse>(
      EVENTS.ADDRESS.SET_DEFAULT,
      {
        userId: req.user.userId,
        addressId: id,
      },
    );
  }
}
