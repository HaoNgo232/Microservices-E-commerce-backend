import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { UpdateUserDto, ListUsersDto, CreateUserDto } from '@shared/dto/user.dto';
import { ListUsersResponse, UserResponse } from '@shared/main';
import { PrismaService } from '@user-app/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export interface IUserService {
  create(dto: CreateUserDto): Promise<UserResponse>;
  findById(id: string): Promise<UserResponse>;
  findByEmail(email: string): Promise<UserResponse>;
  update(id: string, dto: UpdateUserDto): Promise<UserResponse>;
  deactivate(id: string): Promise<{ message: string }>;
  list(query: ListUsersDto): Promise<ListUsersResponse>;
}

@Injectable()
export class UsersService implements IUserService {
  constructor(private readonly prisma: PrismaService) {}

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
          role: dto.role || 'CUSTOMER', // Mặc định role là CUSTOMER nếu không truyền
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
