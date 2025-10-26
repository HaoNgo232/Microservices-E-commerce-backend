import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { UsersService } from './users.service';
import { UpdateUserDto, UserRole } from '@shared/dto/user.dto';
import * as bcrypt from 'bcryptjs';
import { UserResponse } from '@shared/main';
import { PrismaService } from '@user-app/prisma/prisma.service';

// Mock bcrypt
jest.mock('bcryptjs');

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser: UserResponse = {
        id: '1',
        email: 'test@example.com',
        fullName: 'Test User',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
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
    });

    it('should throw RpcException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(RpcException);
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const updateDto: UpdateUserDto = {
        fullName: 'Updated Name',
        phone: '9876543210',
        role: UserRole.ADMIN,
        isActive: true,
      };

      const mockUpdatedUser = {
        id: '1',
        email: 'test@example.com',
        fullName: updateDto.fullName,
        phone: updateDto.phone,
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
      });
      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.update('1', updateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateDto,
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
    });

    it('should throw RpcException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('999', { fullName: 'Test', role: UserRole.ADMIN }),
      ).rejects.toThrow(RpcException);
    });
  });

  describe('list', () => {
    it('should return paginated user list', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          fullName: 'User 1',
          phone: null,
          role: 'CUSTOMER',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        users: mockUsers,
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });

    it('should filter users by search query', async () => {
      const mockUsers: UserResponse[] = [
        {
          id: '1',
          email: 'john@example.com',
          fullName: 'John Doe',
          phone: null,
          role: UserRole.CUSTOMER,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(1);

      await service.list({ search: 'john', page: 1, pageSize: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'john', mode: 'insensitive' } },
              { fullName: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });
});
