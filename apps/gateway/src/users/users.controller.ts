import { Controller, Get, Put, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { UpdateUserDto, ListUsersDto, UserRole } from '@shared/dto/user.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { UserResponse, ListUsersResponse } from '@shared/types/user.types';

/**
 * Users Controller
 * Gateway endpoint cho user management - forward requests đến user-service
 */
@Controller('users')
export class UsersController extends BaseGatewayController {
  constructor(@Inject('USER_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * GET /users
   * Lấy danh sách users với pagination và filters (admin only)
   * Query params: page?, pageSize?, search?, role?
   */
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  list(@Query() query: ListUsersDto): Promise<ListUsersResponse> {
    return this.send<ListUsersDto, ListUsersResponse>(EVENTS.USER.LIST, query);
  }

  /**
   * GET /users/email/:email
   * Lấy user theo email (admin only)
   * Lưu ý: Phải đặt route này TRƯỚC :id route để tránh conflict
   */
  @Get('email/:email')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findByEmail(@Param('email') email: string): Promise<UserResponse> {
    return this.send<string, UserResponse>(EVENTS.USER.FIND_BY_EMAIL, email);
  }

  /**
   * GET /users/:id
   * Lấy chi tiết user theo ID
   */
  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  findById(@Param('id') id: string): Promise<UserResponse> {
    return this.send<string, UserResponse>(EVENTS.USER.FIND_BY_ID, id);
  }

  /**
   * PUT /users/:id
   * Cập nhật user
   *
   * Pattern: Combine path param + body DTO
   * Gateway gửi: { id: string; dto: UpdateUserDto }
   * Microservice nhận: { id: string; dto: UpdateUserDto }
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserResponse> {
    const payload = { id, dto };

    return this.send<typeof payload, UserResponse>(EVENTS.USER.UPDATE, payload);
  }

  /**
   * PUT /users/:id/deactivate
   * Vô hiệu hóa user account
   */
  @Put(':id/deactivate')
  @UseGuards(AuthGuard)
  deactivate(@Param('id') id: string): Promise<UserResponse> {
    return this.send<string, UserResponse>(EVENTS.USER.DEACTIVATE, id);
  }
}
