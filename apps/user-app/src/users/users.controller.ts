import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from '@user-app/users/users.service';
import { EVENTS } from '@shared/events';
import { UpdateUserDto, ListUsersDto, CreateUserDto } from '@shared/dto/user.dto';
import { ListUsersResponse, UserResponse } from '@shared/types';

/**
 * Interface cho Users Controller
 * Liệt kê các chức năng xử lý user
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
  deactivate(id: string): Promise<UserResponse>;

  /**
   * Lấy danh sách users với phân trang
   */
  list(query: ListUsersDto): Promise<ListUsersResponse>;
}

/**
 * UsersController - Nhận và xử lý tin nhắn NATS cho user
 *
 * Nhận các lệnh từ NATS và chuyển đến service xử lý:
 * - CREATE: Tạo user mới (chỉ admin)
 * - FIND_BY_ID: Lấy thông tin user theo ID
 * - FIND_BY_EMAIL: Tìm user theo email
 * - UPDATE: Cập nhật thông tin user
 * - DEACTIVATE: Khóa tài khoản user
 * - LIST: Lấy danh sách user có phân trang và tìm kiếm
 *
 * **Chú ý:** Controller chỉ nhận lệnh, logic xử lý ở `UsersService`
 */
@Controller()
export class UsersController implements IUsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Nhận lệnh tạo user mới từ NATS
   *
   * Pattern: user.create
   * @param dto - Thông tin user cần tạo { email, password, fullName, phone?, role? }
   * @returns Thông tin user vừa tạo (không có mật khẩu)
   */
  @MessagePattern(EVENTS.USER.CREATE)
  create(@Payload() dto: CreateUserDto): Promise<UserResponse> {
    return this.usersService.create(dto);
  }

  /**
   * Nhận lệnh tìm user theo ID từ NATS
   *
   * Pattern: user.findById
   * @param id - ID của user cần tìm
   * @returns Thông tin user (không có mật khẩu)
   */
  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  findById(@Payload() id: string): Promise<UserResponse> {
    return this.usersService.findById(id);
  }

  /**
   * Nhận lệnh tìm user theo email từ NATS
   *
   * Pattern: user.findByEmail
   * @param email - Email của user cần tìm
   * @returns Thông tin user (không có mật khẩu)
   */
  @MessagePattern(EVENTS.USER.FIND_BY_EMAIL)
  findByEmail(@Payload() email: string): Promise<UserResponse> {
    return this.usersService.findByEmail(email);
  }

  /**
   * Nhận lệnh cập nhật user từ NATS
   *
   * Pattern: user.update
   * @param payload - { id, dto } - ID user và dữ liệu cập nhật
   * @returns Thông tin user sau khi cập nhật
   */
  @MessagePattern(EVENTS.USER.UPDATE)
  update(@Payload() payload: { id: string; dto: UpdateUserDto }): Promise<UserResponse> {
    return this.usersService.update(payload.id, payload.dto);
  }

  /**
   * Nhận lệnh khóa tài khoản user từ NATS
   *
   * Pattern: user.deactivate
   * @param id - ID của user cần khóa
   * @returns Thông tin user đã bị khóa
   */
  @MessagePattern(EVENTS.USER.DEACTIVATE)
  deactivate(@Payload() id: string): Promise<UserResponse> {
    return this.usersService.deactivate(id);
  }

  /**
   * Nhận lệnh lấy danh sách user từ NATS
   *
   * Pattern: user.list
   * @param query - Điều kiện lọc { page?, pageSize?, search?, role? }
   * @returns Danh sách user có phân trang
   */
  @MessagePattern(EVENTS.USER.LIST)
  list(@Payload() query: ListUsersDto): Promise<ListUsersResponse> {
    return this.usersService.list(query);
  }
}
