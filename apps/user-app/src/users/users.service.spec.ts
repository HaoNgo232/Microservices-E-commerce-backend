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

  describe('create', () => {
    it('should create user successfully', async () => {
      const createDto = {
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
      };

      const mockHashedPassword = 'hashed_password_123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHashedPassword);

      const mockCreatedUser = {
        id: 'new-id',
        email: createDto.email,
        fullName: createDto.fullName,
        phone: createDto.phone,
        role: 'CUSTOMER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(null); // No existing user
      prisma.user.create.mockResolvedValue(mockCreatedUser);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCreatedUser);
      expect(bcrypt.hash).toHaveBeenCalledWith(createDto.password, 10);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: createDto.email },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: createDto.email,
          passwordHash: mockHashedPassword,
          fullName: createDto.fullName,
          phone: createDto.phone,
          role: createDto.role,
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
    });

    it('should throw RpcException when email already exists', async () => {
      const createDto = {
        email: 'existing@example.com',
        password: 'password123',
        fullName: 'Test User',
        role: UserRole.CUSTOMER,
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: createDto.email,
      });

      await expect(service.create(createDto)).rejects.toThrow(RpcException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should create user with ADMIN role when specified', async () => {
      const createDto = {
        email: 'admin@example.com',
        password: 'password123',
        fullName: 'Admin User',
        role: UserRole.ADMIN,
      };

      const mockHashedPassword = 'hashed_password_123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHashedPassword);

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-id',
        email: createDto.email,
        fullName: createDto.fullName,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(createDto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.ADMIN,
          }),
        }),
      );
    });

    it('should throw RpcException when user creation fails', async () => {
      const createDto = {
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
        role: UserRole.CUSTOMER,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(null); // Creation failed

      await expect(service.create(createDto)).rejects.toThrow(RpcException);
    });

    it('should handle database errors during creation', async () => {
      const createDto = {
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
        role: UserRole.CUSTOMER,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDto)).rejects.toThrow(RpcException);
    });
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

    it('should handle database errors when finding by id', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.findById('1')).rejects.toThrow(RpcException);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
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

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
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

    it('should throw RpcException when user not found by email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByEmail('notfound@example.com')).rejects.toThrow(RpcException);
    });

    it('should handle database errors when finding by email', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.findByEmail('test@example.com')).rejects.toThrow(RpcException);
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

      await expect(service.update('999', { fullName: 'Test', role: UserRole.ADMIN })).rejects.toThrow(RpcException);
    });

    it('should handle database errors during update', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@example.com' });
      prisma.user.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update('1', { fullName: 'Test', role: UserRole.ADMIN })).rejects.toThrow(RpcException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      const mockUser: UserResponse = {
        id: '1',
        email: 'test@example.com',
        fullName: 'Test User',
        phone: null,
        role: UserRole.CUSTOMER,
        isActive: false,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.deactivate('1');

      expect(result).toEqual(mockUser);
      expect(result.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });

    it('should throw RpcException when user not found for deactivation', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('999')).rejects.toThrow(RpcException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle database errors during deactivation', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@example.com' });
      prisma.user.update.mockRejectedValue(new Error('Database error'));

      await expect(service.deactivate('1')).rejects.toThrow(RpcException);
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

    it('should use default pagination when not provided', async () => {
      const mockUsers: UserResponse[] = [];

      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.list({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
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

    it('should calculate skip correctly for pagination', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list({ page: 3, pageSize: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3 - 1) * 20
          take: 20,
        }),
      );
    });

    it('should order users by createdAt desc', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list({ page: 1, pageSize: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should handle database errors during list', async () => {
      prisma.user.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.list({ page: 1, pageSize: 10 })).rejects.toThrow(RpcException);
    });
  });
});
