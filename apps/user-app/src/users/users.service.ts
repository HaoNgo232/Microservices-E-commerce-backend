import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { UpdateUserDto, ListUsersDto, CreateUserDto } from '@shared/dto/user.dto';
import { ListUsersResponse, UserResponse } from '@shared/types';
import { PrismaService } from '@user-app/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

/**
 * Interface cho User Service
 * Định nghĩa các phương thức quản lý users
 */
export interface IUserService {
  /**
   * Tạo user mới
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
  update(id: string, dto: UpdateUserDto): Promise<UserResponse>;

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
 * UsersService - Service quản lý users
 *
 * Xử lý business logic liên quan đến:
 * - Tạo user mới (admin only, hash password)
 * - Tìm kiếm user (by ID, by email)
 * - Cập nhật user info (fullName, phone, role, isActive)
 * - Vô hiệu hóa user account (soft delete)
 * - Liệt kê users với pagination và search
 *
 * **Security:**
 * - Password luôn được hash bằng bcrypt trước khi lưu
 * - Response KHÔNG bao gồm passwordHash
 * - Chỉ admin có thể tạo user và set role
 */
@Injectable()
export class UsersService implements IUserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo user mới
   *
   * Flow:
   * 1. Validate email chưa tồn tại
   * 2. Hash password bằng bcrypt (salt rounds = 10)
   * 3. Tạo user với role (mặc định CUSTOMER nếu không truyền)
   *
   * **QUAN TRỌNG:** Password KHÔNG BAO GIỜ lưu plain text
   *
   * @param dto - { email, password, fullName, phone?, role? }
   * @returns User đã tạo (không bao gồm passwordHash)
   * @throws RpcException nếu email đã tồn tại hoặc có lỗi database
   */
  async create(dto: CreateUserDto): Promise<UserResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        throw new RpcException({
          statusCode: 400,
          message: 'Email already exists',
        });
      }

      // Hash password với bcrypt (salt rounds = 10)
      // QUAN TRỌNG: Không bao giờ lưu plain password vào DB
      const passwordHash = await bcrypt.hash(dto.password, 10);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          role: dto.role,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new RpcException({
          statusCode: 400,
          message: 'Failed to create user',
        });
      }

      // Type assertion: Prisma enum → Shared enum
      // LƯU Ý: Response KHÔNG bao gồm passwordHash (vì không select nó)
      return user as UserResponse;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[UsersService] create error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to create user',
      });
    }
  }

  /**
   * Tìm user theo ID
   *
   * @param id - User ID
   * @returns User info (không bao gồm passwordHash)
   * @throws RpcException nếu user không tồn tại hoặc có lỗi database
   */
  async findById(id: string): Promise<UserResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new RpcException({
          statusCode: 404,
          message: `User with ID ${id} not found`,
        });
      }

      // Type assertion: Prisma enum → Shared enum
      return user as UserResponse;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[UsersService] findById error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to find user',
      });
    }
  }

  /**
   * Tìm user theo email
   *
   * @param email - User email
   * @returns User info (không bao gồm passwordHash)
   * @throws RpcException nếu user không tồn tại hoặc có lỗi database
   */
  async findByEmail(email: string): Promise<UserResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new RpcException({
          statusCode: 404,
          message: `User with email ${email} not found`,
        });
      }

      // Type assertion: Prisma enum → Shared enum
      return user as UserResponse;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[UsersService] findByEmail error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to find user by email',
      });
    }
  }

  /**
   * Cập nhật user info
   *
   * Cho phép cập nhật:
   * - fullName: Họ tên
   * - phone: Số điện thoại
   * - role: Vai trò (ADMIN/CUSTOMER)
   * - isActive: Trạng thái active
   *
   * @param id - User ID
   * @param dto - Dữ liệu cập nhật (partial)
   * @returns User đã cập nhật
   * @throws RpcException nếu user không tồn tại hoặc có lỗi database
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    try {
      await this.validateUserExists(id);

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          role: dto.role,
          isActive: dto.isActive,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Type assertion: Prisma enum → Shared enum
      return user as UserResponse;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[UsersService] update error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to update user',
      });
    }
  }

  /**
   * Vô hiệu hóa user account
   *
   * Soft delete: Set isActive = false thay vì xóa khỏi database
   * User không thể login sau khi bị deactivate
   *
   * @param id - User ID
   * @returns Success message
   * @throws RpcException nếu user không tồn tại hoặc có lỗi database
   */
  async deactivate(id: string): Promise<{ message: string }> {
    try {
      await this.validateUserExists(id);

      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return { message: `User ${id} deactivated successfully` };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[UsersService] deactivate error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to deactivate user',
      });
    }
  }

  /**
   * Lấy danh sách users với pagination và search
   *
   * **Features:**
   * - Pagination: page bắt đầu từ 1, default pageSize = 10
   * - Search: Tìm kiếm trong email HOẶC fullName (case-insensitive)
   * - Sorting: Sắp xếp theo createdAt desc (mới nhất lên đầu)
   *
   * **Performance Optimization:**
   * - Chạy song song findMany và count bằng Promise.all
   *
   * @param query - { page?, pageSize?, search? }
   * @returns Danh sách users với pagination metadata
   * @throws RpcException nếu có lỗi database
   */
  async list(query: ListUsersDto): Promise<ListUsersResponse> {
    try {
      // Pagination: page bắt đầu từ 1 (không phải 0)
      const page = query.page || 1;
      const pageSize = query.pageSize || 10;
      const skip = (page - 1) * pageSize; // skip = số record bỏ qua

      // Search filter: Tìm kiếm trong email HOẶC fullName
      // 'insensitive': không phân biệt hoa/thường (case-insensitive)
      // 'contains': tìm chuỗi con (giống LIKE '%search%' trong SQL)
      const where = query.search
        ? {
            OR: [
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                fullName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}; // Nếu không có search → lấy tất cả

      // Promise.all: Chạy song song 2 query để tối ưu performance
      // - findMany: lấy data cho trang hiện tại
      // - count: đếm tổng số record (để tính tổng số trang)
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' }, // Mới nhất lên đầu
        }),
        this.prisma.user.count({ where }),
      ]);

      // Type assertion: Prisma enum → Shared enum
      return { users: users as UserResponse[], total, page, pageSize };
    } catch (error) {
      console.error('[UsersService] list error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to list users',
      });
    }
  }

  /**
   * Validate user tồn tại trong database
   *
   * @param id - User ID cần kiểm tra
   * @throws RpcException nếu user không tồn tại
   * @private
   */
  private async validateUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new RpcException({
        statusCode: 404,
        message: `User with ID ${id} not found`,
      });
    }
  }
}
