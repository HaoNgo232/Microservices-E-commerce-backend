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
   * Lấy danh sách users (admin only)
   */
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  list(@Query() query: ListUsersDto): Promise<ListUsersResponse> {
    return this.send<ListUsersDto, ListUsersResponse>(EVENTS.USER.LIST, query);
  }

  /**
   * GET /users/:id
   * Lấy chi tiết user theo ID
   * CUSTOMER có thể xem profile của mình, ADMIN có thể xem tất cả
   */
  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
  findById(@Param('id') id: string): Promise<UserResponse> {
    // TODO: Add ownership check in service layer (CUSTOMER chỉ xem được profile của mình)
    return this.send<string, UserResponse>(EVENTS.USER.FIND_BY_ID, id);
  }

  /**
   * GET /users/email/:email
   * Lấy user theo email (admin only)
   */
  @Get('email/:email')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findByEmail(@Param('email') email: string): Promise<UserResponse> {
    return this.send<string, UserResponse>(EVENTS.USER.FIND_BY_EMAIL, email);
  }

  /**
   * PUT /users/:id
   * Cập nhật user
   * CUSTOMER có thể update profile của mình, ADMIN có thể update tất cả
   */
  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserResponse> {
    // TODO: Add ownership check in service layer (CUSTOMER chỉ update được profile của mình)
    return this.send<UpdateUserDto & { id: string }, UserResponse>(EVENTS.USER.UPDATE, {
      id,
      ...dto,
    });
  }

  /**
   * PUT /users/:id/deactivate
   * Vô hiệu hóa user account (admin only)
   */
  @Put(':id/deactivate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id') id: string): Promise<UserResponse> {
    return this.send<string, UserResponse>(EVENTS.USER.DEACTIVATE, id);
  }
}
