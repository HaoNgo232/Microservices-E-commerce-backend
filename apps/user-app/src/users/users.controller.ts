import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from '@user-app/users/users.service';
import { EVENTS } from '@shared/events';
import { UpdateUserDto, ListUsersDto, CreateUserDto } from '@shared/dto/user.dto';
import { ListUsersResponse, UserResponse } from '@shared/types';

/**
 * Interface cho Users Controller
 * Định nghĩa các phương thức quản lý users
 */
export interface IUsersController {
  /**
   * Tạo user mới (admin only)
   */
  create(dto: CreateUserDto): Promise<UserResponse>;

  /**
   * Tìm user theo ID
   */
  findById(id: string): Promise<UserResponse>;

  /**
   * Tìm user theo email
   */
  findByEmail(email: string): Promise<UserResponse>;

  /**
   * Cập nhật user
   */
  update(payload: { id: string; dto: UpdateUserDto }): Promise<UserResponse>;

  /**
   * Vô hiệu hóa user account
   */
  deactivate(id: string): Promise<{ message: string }>;

  /**
   * Lấy danh sách users với phân trang
   */
  list(query: ListUsersDto): Promise<ListUsersResponse>;
}

/**
 * UsersController - NATS Message Handler cho Users
 *
 * Xử lý các NATS messages liên quan đến user management:
 * - CREATE: Tạo user mới (admin only)
 * - FIND_BY_ID: Lấy user theo ID
 * - FIND_BY_EMAIL: Lấy user theo email
 * - UPDATE: Cập nhật user info
 * - DEACTIVATE: Vô hiệu hóa user account
 * - LIST: Lấy danh sách users với pagination và search
 *
 * **Note:** Controller chỉ route messages, business logic ở UsersService
 */
@Controller()
export class UsersController implements IUsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * NATS Handler: Tạo user mới
   *
   * Pattern: user.create
   * @param dto - { email, password, fullName, phone?, role? }
   * @returns User đã tạo (không bao gồm passwordHash)
   */
  @MessagePattern(EVENTS.USER.CREATE)
  create(@Payload() dto: CreateUserDto): Promise<UserResponse> {
    return this.usersService.create(dto);
  }

  /**
   * NATS Handler: Tìm user theo ID
   *
   * Pattern: user.findById
   * @param id - User ID
   * @returns User info (không bao gồm passwordHash)
   */
  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  findById(@Payload() id: string): Promise<UserResponse> {
    return this.usersService.findById(id);
  }

  /**
   * NATS Handler: Tìm user theo email
   *
   * Pattern: user.findByEmail
   * @param email - User email
   * @returns User info (không bao gồm passwordHash)
   */
  @MessagePattern(EVENTS.USER.FIND_BY_EMAIL)
  findByEmail(@Payload() email: string): Promise<UserResponse> {
    return this.usersService.findByEmail(email);
  }

  /**
   * NATS Handler: Cập nhật user
   *
   * Pattern: user.update
   * @param payload - { id, dto }
   * @returns User đã cập nhật
   */
  @MessagePattern(EVENTS.USER.UPDATE)
  update(@Payload() payload: { id: string; dto: UpdateUserDto }): Promise<UserResponse> {
    return this.usersService.update(payload.id, payload.dto);
  }

  /**
   * NATS Handler: Vô hiệu hóa user account
   *
   * Pattern: user.deactivate
   * @param id - User ID
   * @returns Success message
   */
  @MessagePattern(EVENTS.USER.DEACTIVATE)
  deactivate(@Payload() id: string): Promise<{
    message: string;
  }> {
    return this.usersService.deactivate(id);
  }

  /**
   * NATS Handler: Lấy danh sách users
   *
   * Pattern: user.list
   * @param query - { page?, pageSize?, search? }
   * @returns Danh sách users với pagination
   */
  @MessagePattern(EVENTS.USER.LIST)
  list(@Payload() query: ListUsersDto): Promise<ListUsersResponse> {
    return this.usersService.list(query);
  }
}
