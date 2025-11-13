import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { AddressService } from './address.service';
import {
  AddressCreateDto,
  AddressUpdateDto,
  AddressListByUserDto,
  AddressSetDefaultDto,
} from '@shared/dto/address.dto';
import { PrismaService } from '@user-app/prisma/prisma.service';

describe('AddressService', () => {
  let service: AddressService;
  let prisma: PrismaService;

  const mockPrismaService = {
    address: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(), //  Add count method
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AddressService>(AddressService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('listByUser', () => {
    it('nên trả về danh sách địa chỉ của user', async () => {
      const dto: AddressListByUserDto = { userId: 'user123' };
      const mockAddresses = [
        {
          id: 'addr1',
          userId: 'user123',
          fullName: 'Nguyễn Văn A',
          phone: '0123456789',
          street: '123 Lê Lợi',
          ward: 'Phường 1',
          district: 'Quận 1',
          city: 'TP.HCM',
          isDefault: true,
          createdAt: new Date(),
        },
        {
          id: 'addr2',
          userId: 'user123',
          fullName: 'Nguyễn Văn B',
          phone: '0987654321',
          street: '456 Nguyễn Huệ',
          ward: 'Phường 2',
          district: 'Quận 1',
          city: 'TP.HCM',
          isDefault: false,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.address.findMany.mockResolvedValue(mockAddresses);

      const result = await service.listByUser(dto);

      expect(result).toEqual(mockAddresses);
      expect(prisma.address.findMany).toHaveBeenCalledWith({
        where: { userId: dto.userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('nên trả về mảng rỗng nếu user không có địa chỉ', async () => {
      const dto: AddressListByUserDto = { userId: 'user123' };

      mockPrismaService.address.findMany.mockResolvedValue([]);

      const result = await service.listByUser(dto);

      expect(result).toEqual([]);
    });

    it('nên throw RpcException khi có lỗi database', async () => {
      const dto: AddressListByUserDto = { userId: 'user123' };

      mockPrismaService.address.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.listByUser(dto)).rejects.toThrow(RpcException);
    });
  });

  describe('create', () => {
    it('nên tạo địa chỉ mới thành công', async () => {
      const userId = 'user123';
      const dto: AddressCreateDto = {
        fullName: 'Nguyễn Văn A',
        phone: '0123456789',
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: false,
      };

      const mockUser = { id: userId };
      const mockCreatedAddress = {
        id: 'addr1',
        userId,
        ...dto,
        isDefault: false, // Not first address
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.address.count.mockResolvedValue(2); //  User already has 2 addresses
      mockPrismaService.address.create.mockResolvedValue(mockCreatedAddress);

      const result = await service.create({ userId, dto });

      expect(result).toEqual(mockCreatedAddress);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
      expect(prisma.address.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          street: dto.street,
          ward: dto.ward,
          district: dto.district,
          city: dto.city,
          isDefault: false, // Not first, so stays false
        },
      });
    });

    it('nên set địa chỉ làm mặc định khi isDefault = true', async () => {
      const userId = 'user123';
      const dto: AddressCreateDto = {
        fullName: 'Nguyễn Văn A',
        phone: '0123456789',
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: true,
      };

      const mockUser = { id: userId };
      const mockCreatedAddress = {
        id: 'addr1',
        userId,
        ...dto,
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.address.count.mockResolvedValue(2); //  User has addresses
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.address.create.mockResolvedValue(mockCreatedAddress);

      const result = await service.create({ userId, dto });

      expect(result).toEqual(mockCreatedAddress);
      expect(prisma.address.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { isDefault: false },
      });
    });

    it('nên tự động set địa chỉ đầu tiên làm default dù client set false', async () => {
      const userId = 'user123';
      const dto: AddressCreateDto = {
        fullName: 'Nguyễn Văn A',
        phone: '0123456789',
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: false, // Client set false
      };

      const mockUser = { id: userId };
      const mockCreatedAddress = {
        id: 'addr1',
        userId,
        fullName: dto.fullName,
        phone: dto.phone,
        street: dto.street,
        ward: dto.ward,
        district: dto.district,
        city: dto.city,
        isDefault: true, // But service auto-set to true for first address
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.address.count.mockResolvedValue(0); //  First address (count = 0)
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.address.create.mockResolvedValue(mockCreatedAddress);

      const result = await service.create({ userId, dto });

      expect(result).toEqual(mockCreatedAddress);
      expect(prisma.address.count).toHaveBeenCalledWith({
        where: { userId },
      });
      // Should call updateMany even for first address (to ensure consistency)
      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { isDefault: false },
      });
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          street: dto.street,
          ward: dto.ward,
          district: dto.district,
          city: dto.city,
          isDefault: true, //  Auto-set to true for first address
        },
      });
    });

    it('nên throw RpcException khi user không tồn tại', async () => {
      const userId = 'nonexistent';
      const dto: AddressCreateDto = {
        fullName: 'Nguyễn Văn A',
        phone: '0123456789',
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create({ userId, dto })).rejects.toThrow(RpcException);
    });

    it('nên throw RpcException khi có lỗi tạo địa chỉ', async () => {
      const userId = 'user123';
      const dto: AddressCreateDto = {
        fullName: 'Nguyễn Văn A',
        phone: '0123456789',
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.address.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create({ userId, dto })).rejects.toThrow(RpcException);
    });
  });

  describe('update', () => {
    it('nên cập nhật địa chỉ thành công', async () => {
      const addressId = 'addr1';
      const dto: AddressUpdateDto = {
        fullName: 'Nguyễn Văn B',
        phone: '0987654321',
      };

      const mockExistingAddress = {
        id: addressId,
        userId: 'user123',
      };

      const mockUpdatedAddress = {
        id: addressId,
        userId: 'user123',
        fullName: dto.fullName,
        phone: dto.phone,
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: false,
        createdAt: new Date(),
      };

      mockPrismaService.address.findUnique.mockResolvedValue(mockExistingAddress);
      mockPrismaService.address.update.mockResolvedValue(mockUpdatedAddress);

      const result = await service.update(addressId, dto);

      expect(result).toEqual(mockUpdatedAddress);
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: addressId },
        data: dto,
      });
    });

    it('nên set địa chỉ làm mặc định và bỏ mặc định các địa chỉ khác', async () => {
      const addressId = 'addr1';
      const dto: AddressUpdateDto = {
        isDefault: true,
      };

      const mockExistingAddress = {
        id: addressId,
        userId: 'user123',
      };

      const mockUpdatedAddress = {
        id: addressId,
        userId: 'user123',
        fullName: 'Nguyễn Văn A',
        phone: '0123456789',
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: true,
        createdAt: new Date(),
      };

      mockPrismaService.address.findUnique.mockResolvedValue(mockExistingAddress);
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.address.update.mockResolvedValue(mockUpdatedAddress);

      const result = await service.update(addressId, dto);

      expect(result).toEqual(mockUpdatedAddress);
      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user123', id: { not: addressId } },
        data: { isDefault: false },
      });
    });

    it('nên throw RpcException khi địa chỉ không tồn tại', async () => {
      const addressId = 'nonexistent';
      const dto: AddressUpdateDto = {
        fullName: 'Nguyễn Văn B',
      };

      mockPrismaService.address.findUnique.mockResolvedValue(null);

      await expect(service.update(addressId, dto)).rejects.toThrow(RpcException);
    });

    it('nên throw RpcException khi có lỗi cập nhật', async () => {
      const addressId = 'addr1';
      const dto: AddressUpdateDto = {
        fullName: 'Nguyễn Văn B',
      };

      mockPrismaService.address.findUnique.mockResolvedValue({
        id: addressId,
        userId: 'user123',
      });
      mockPrismaService.address.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update(addressId, dto)).rejects.toThrow(RpcException);
    });
  });

  describe('delete', () => {
    it('nên xóa địa chỉ thành công', async () => {
      const addressId = 'addr1';
      const mockExistingAddress = {
        id: addressId,
        isDefault: false,
        userId: 'user123',
      };

      mockPrismaService.address.findUnique.mockResolvedValue(mockExistingAddress);
      mockPrismaService.address.delete.mockResolvedValue(mockExistingAddress);

      const result = await service.delete(addressId);

      expect(result).toEqual({
        success: true,
        message: 'Đã xóa địa chỉ thành công',
      });
      expect(prisma.address.delete).toHaveBeenCalledWith({
        where: { id: addressId },
      });
    });

    it('nên set địa chỉ khác làm mặc định khi xóa địa chỉ mặc định', async () => {
      const addressId = 'addr1';
      const mockExistingAddress = {
        id: addressId,
        isDefault: true,
        userId: 'user123',
      };

      const mockNextAddress = {
        id: 'addr2',
        userId: 'user123',
        fullName: 'Nguyễn Văn B',
        phone: '0987654321',
        street: '456 Nguyễn Huệ',
        ward: 'Phường 2',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: false,
        createdAt: new Date(),
      };

      mockPrismaService.address.findUnique.mockResolvedValue(mockExistingAddress);
      mockPrismaService.address.delete.mockResolvedValue(mockExistingAddress);
      mockPrismaService.address.findFirst.mockResolvedValue(mockNextAddress);
      mockPrismaService.address.update.mockResolvedValue({
        ...mockNextAddress,
        isDefault: true,
      });

      const result = await service.delete(addressId);

      expect(result).toEqual({
        success: true,
        message: 'Đã xóa địa chỉ thành công',
      });
      expect(prisma.address.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        orderBy: { createdAt: 'asc' },
      });
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr2' },
        data: { isDefault: true },
      });
    });

    it('nên throw RpcException khi địa chỉ không tồn tại', async () => {
      const addressId = 'nonexistent';

      mockPrismaService.address.findUnique.mockResolvedValue(null);

      await expect(service.delete(addressId)).rejects.toThrow(RpcException);
    });

    it('nên throw RpcException khi có lỗi xóa', async () => {
      const addressId = 'addr1';

      mockPrismaService.address.findUnique.mockResolvedValue({
        id: addressId,
        isDefault: false,
        userId: 'user123',
      });
      mockPrismaService.address.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.delete(addressId)).rejects.toThrow(RpcException);
    });
  });

  describe('setDefaultAddress', () => {
    it('nên đặt địa chỉ làm mặc định thành công', async () => {
      const dto: AddressSetDefaultDto = {
        addressId: 'addr1',
        userId: 'user123',
      };

      const mockExistingAddress = {
        id: 'addr1',
        userId: 'user123',
      };

      const mockUpdatedAddress = {
        id: 'addr1',
        userId: 'user123',
        fullName: 'Nguyễn Văn A',
        phone: '0123456789',
        street: '123 Lê Lợi',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: true,
        createdAt: new Date(),
      };

      mockPrismaService.address.findFirst.mockResolvedValue(mockExistingAddress);
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.address.update.mockResolvedValue(mockUpdatedAddress);

      const result = await service.setDefaultAddress(dto);

      expect(result).toEqual(mockUpdatedAddress);
      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId: dto.userId },
        data: { isDefault: false },
      });
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: dto.addressId },
        data: { isDefault: true },
      });
    });

    it('nên throw RpcException khi địa chỉ không tồn tại hoặc không thuộc về user', async () => {
      const dto: AddressSetDefaultDto = {
        addressId: 'addr1',
        userId: 'user123',
      };

      mockPrismaService.address.findFirst.mockResolvedValue(null);

      await expect(service.setDefaultAddress(dto)).rejects.toThrow(RpcException);
    });

    it('nên throw RpcException khi có lỗi cập nhật', async () => {
      const dto: AddressSetDefaultDto = {
        addressId: 'addr1',
        userId: 'user123',
      };

      mockPrismaService.address.findFirst.mockResolvedValue({
        id: 'addr1',
        userId: 'user123',
      });
      mockPrismaService.address.updateMany.mockRejectedValue(new Error('Database error'));

      await expect(service.setDefaultAddress(dto)).rejects.toThrow(RpcException);
    });
  });
});
