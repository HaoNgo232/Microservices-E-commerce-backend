import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserDto, ListUsersDto, UserRole } from '@shared/dto/user.dto';
import { ListUsersResponse, UserResponse } from '@shared/main';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    list: jest.fn(),
  };

  const mockUserResponse: UserResponse = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    phone: '0123456789',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockListUsersResponse: ListUsersResponse = {
    users: [mockUserResponse],
    total: 1,
    page: 1,
    pageSize: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findById', () => {
    it('nên tìm user theo ID thành công', async () => {
      const userId = 'user-123';
      mockUsersService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.findById(userId);

      expect(result).toEqual(mockUserResponse);
      expect(service.findById).toHaveBeenCalledWith(userId);
      expect(service.findById).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi user không tồn tại', async () => {
      const userId = 'non-existent';
      const error = new Error('User not found');
      mockUsersService.findById.mockRejectedValue(error);

      await expect(controller.findById(userId)).rejects.toThrow('User not found');
      expect(service.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('findByEmail', () => {
    it('nên tìm user theo email thành công', async () => {
      const email = 'test@example.com';
      mockUsersService.findByEmail.mockResolvedValue(mockUserResponse);

      const result = await controller.findByEmail(email);

      expect(result).toEqual(mockUserResponse);
      expect(service.findByEmail).toHaveBeenCalledWith(email);
      expect(service.findByEmail).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi email không tồn tại', async () => {
      const email = 'notfound@example.com';
      const error = new Error('User not found');
      mockUsersService.findByEmail.mockRejectedValue(error);

      await expect(controller.findByEmail(email)).rejects.toThrow('User not found');
      expect(service.findByEmail).toHaveBeenCalledWith(email);
    });
  });

  describe('update', () => {
    it('nên cập nhật user thành công', async () => {
      const userId = 'user-123';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Updated User',
        phone: '0111222333',
        role: UserRole.ADMIN,
      };
      const updatedResponse = {
        ...mockUserResponse,
        fullName: updateUserDto.fullName,
        phone: updateUserDto.phone,
        role: updateUserDto.role,
      };
      mockUsersService.update.mockResolvedValue(updatedResponse);

      const result = await controller.update({ id: userId, dto: updateUserDto });

      expect(result).toEqual(updatedResponse);
      expect(service.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi user không tồn tại', async () => {
      const userId = 'non-existent';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Updated Name',
      };
      const error = new Error('User not found');
      mockUsersService.update.mockRejectedValue(error);

      await expect(controller.update({ id: userId, dto: updateUserDto })).rejects.toThrow('User not found');
      expect(service.update).toHaveBeenCalledWith(userId, updateUserDto);
    });

    it('nên cập nhật partial data', async () => {
      const userId = 'user-123';
      const partialUpdate: UpdateUserDto = {
        fullName: 'Partial Update',
      };
      const partialResponse = {
        ...mockUserResponse,
        fullName: partialUpdate.fullName,
      };
      mockUsersService.update.mockResolvedValue(partialResponse);

      const result = await controller.update({ id: userId, dto: partialUpdate });

      expect(result.fullName).toBe(partialUpdate.fullName);
      expect(service.update).toHaveBeenCalledWith(userId, partialUpdate);
    });
  });

  describe('deactivate', () => {
    it('nên vô hiệu hóa user thành công', async () => {
      const userId = 'user-123';
      const deactivatedUser: UserResponse = {
        ...mockUserResponse,
        id: userId,
        isActive: false,
      };
      mockUsersService.deactivate.mockResolvedValue(deactivatedUser);

      const result = await controller.deactivate(userId);

      expect(result).toEqual(deactivatedUser);
      expect(result.isActive).toBe(false);
      expect(service.deactivate).toHaveBeenCalledWith(userId);
      expect(service.deactivate).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi user không tồn tại', async () => {
      const userId = 'non-existent';
      const error = new Error('User not found');
      mockUsersService.deactivate.mockRejectedValue(error);

      await expect(controller.deactivate(userId)).rejects.toThrow('User not found');
      expect(service.deactivate).toHaveBeenCalledWith(userId);
    });
  });

  describe('list', () => {
    it('nên liệt kê users với pagination', async () => {
      const listUsersDto: ListUsersDto = {
        page: 1,
        pageSize: 10,
        search: 'test',
      };
      mockUsersService.list.mockResolvedValue(mockListUsersResponse);

      const result = await controller.list(listUsersDto);

      expect(result).toEqual(mockListUsersResponse);
      expect(service.list).toHaveBeenCalledWith(listUsersDto);
      expect(service.list).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi từ service', async () => {
      const listUsersDto: ListUsersDto = {
        page: 1,
        pageSize: 10,
      };
      const error = new Error('Database connection failed');
      mockUsersService.list.mockRejectedValue(error);

      await expect(controller.list(listUsersDto)).rejects.toThrow('Database connection failed');
      expect(service.list).toHaveBeenCalledWith(listUsersDto);
    });

    it('nên trả về danh sách rỗng khi không có users', async () => {
      const emptyResponse: ListUsersResponse = {
        users: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };
      mockUsersService.list.mockResolvedValue(emptyResponse);

      const result = await controller.list({ page: 1, pageSize: 10 });

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(service.list).toHaveBeenCalled();
    });

    it('nên filter users theo search query', async () => {
      const searchQuery: ListUsersDto = {
        search: 'john',
        page: 1,
        pageSize: 5,
      };
      const filteredResponse = {
        users: [
          {
            ...mockUserResponse,
            email: 'john@example.com',
            fullName: 'John Doe',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 5,
      };
      mockUsersService.list.mockResolvedValue(filteredResponse);

      const result = await controller.list(searchQuery);

      expect(result.users).toHaveLength(1);
      expect(result.users[0].fullName).toContain('John');
      expect(service.list).toHaveBeenCalledWith(searchQuery);
    });
  });

  describe('Integration Tests', () => {
    it('nên handle concurrent requests', async () => {
      // Setup mock TRƯỚC KHI gọi concurrent requests
      mockUsersService.findById.mockResolvedValue(mockUserResponse);

      const promises = Array.from({ length: 3 }, (_, i) => controller.findById(`user-${i}`));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(service.findById).toHaveBeenCalledTimes(3);
    });

    it('nên maintain service method signatures', () => {
      expect(typeof controller.findById).toBe('function');
      expect(typeof controller.findByEmail).toBe('function');
      expect(typeof controller.update).toBe('function');
      expect(typeof controller.deactivate).toBe('function');
      expect(typeof controller.list).toBe('function');
    });
  });
});
