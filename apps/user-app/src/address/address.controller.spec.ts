import { Test, TestingModule } from '@nestjs/testing';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import {
  AddressCreateDto,
  AddressUpdateDto,
  AddressListByUserDto,
  AddressSetDefaultDto,
} from '@shared/dto/address.dto';
import { AddressResponse } from '@shared/types/address.types';

describe('AddressController', () => {
  let controller: AddressController;
  let service: AddressService;

  const mockAddressService = {
    listByUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setDefaultAddress: jest.fn(),
  };

  const mockAddressResponse: AddressResponse = {
    id: 'addr-123',
    userId: 'user-123',
    fullName: 'Nguyễn Văn A',
    phone: '0123456789',
    street: '123 Lê Lợi',
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    city: 'TP.HCM',
    isDefault: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressController],
      providers: [
        {
          provide: AddressService,
          useValue: mockAddressService,
        },
      ],
    }).compile();

    controller = module.get<AddressController>(AddressController);
    service = module.get<AddressService>(AddressService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listByUser', () => {
    it('nên trả về danh sách địa chỉ của user', async () => {
      const dto: AddressListByUserDto = { userId: 'user-123' };
      const addresses = [mockAddressResponse];
      mockAddressService.listByUser.mockResolvedValue(addresses);

      const result = await controller.listByUser(dto);

      expect(result).toEqual(addresses);
      expect(service.listByUser).toHaveBeenCalledWith(dto);
      expect(service.listByUser).toHaveBeenCalledTimes(1);
    });

    it('nên trả về mảng rỗng nếu user không có địa chỉ', async () => {
      const dto: AddressListByUserDto = { userId: 'user-no-addresses' };
      mockAddressService.listByUser.mockResolvedValue([]);

      const result = await controller.listByUser(dto);

      expect(result).toEqual([]);
      expect(service.listByUser).toHaveBeenCalledWith(dto);
    });

    it('nên handle lỗi từ service', async () => {
      const dto: AddressListByUserDto = { userId: 'user-123' };
      const error = new Error('Database error');
      mockAddressService.listByUser.mockRejectedValue(error);

      await expect(controller.listByUser(dto)).rejects.toThrow('Database error');
      expect(service.listByUser).toHaveBeenCalledWith(dto);
    });
  });

  describe('create', () => {
    it('nên tạo địa chỉ mới thành công', async () => {
      const dto: AddressCreateDto = {
        userId: 'user-123',
        fullName: 'Trần Văn B',
        phone: '0987654321',
        street: '456 Nguyễn Huệ',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP.HCM',
        isDefault: false,
      };
      const createdAddress = { ...mockAddressResponse, ...dto, id: 'addr-new' };
      mockAddressService.create.mockResolvedValue(createdAddress);

      const result = await controller.create(dto);

      expect(result).toEqual(createdAddress);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it('nên tạo địa chỉ mặc định khi isDefault = true', async () => {
      const dto: AddressCreateDto = {
        userId: 'user-123',
        fullName: 'Địa chỉ mặc định',
        phone: '0123456789',
        street: '123 Test Street',
        ward: 'Ward',
        district: 'District',
        city: 'City',
        isDefault: true,
      };
      const defaultAddress = { ...mockAddressResponse, ...dto, id: 'addr-default' };
      mockAddressService.create.mockResolvedValue(defaultAddress);

      const result = await controller.create(dto);

      expect(result.isDefault).toBe(true);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('nên handle lỗi khi user không tồn tại', async () => {
      const dto: AddressCreateDto = {
        userId: 'non-existent',
        fullName: 'Test',
        phone: '0123456789',
        street: 'Street',
        ward: 'Ward',
        district: 'District',
        city: 'City',
      };
      const error = new Error('User not found');
      mockAddressService.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toThrow('User not found');
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('nên cập nhật địa chỉ thành công', async () => {
      const payload = {
        id: 'addr-123',
        dto: {
          fullName: 'Tên đã cập nhật',
          phone: '0999888777',
        } as AddressUpdateDto,
      };
      const updatedAddress = { ...mockAddressResponse, ...payload.dto };
      mockAddressService.update.mockResolvedValue(updatedAddress);

      const result = await controller.update(payload);

      expect(result).toEqual(updatedAddress);
      expect(service.update).toHaveBeenCalledWith(payload.id, payload.dto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi địa chỉ không tồn tại', async () => {
      const payload = {
        id: 'non-existent',
        dto: { fullName: 'Test' } as AddressUpdateDto,
      };
      const error = new Error('Address not found');
      mockAddressService.update.mockRejectedValue(error);

      await expect(controller.update(payload)).rejects.toThrow('Address not found');
      expect(service.update).toHaveBeenCalledWith(payload.id, payload.dto);
    });
  });

  describe('delete', () => {
    it('nên xóa địa chỉ thành công', async () => {
      const id = 'addr-123';
      const deleteResponse = { success: true, message: 'Đã xóa địa chỉ thành công' };
      mockAddressService.delete.mockResolvedValue(deleteResponse);

      const result = await controller.delete(id);

      expect(result).toEqual(deleteResponse);
      expect(service.delete).toHaveBeenCalledWith(id);
      expect(service.delete).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi xóa địa chỉ không tồn tại', async () => {
      const id = 'non-existent';
      const error = new Error('Address not found');
      mockAddressService.delete.mockRejectedValue(error);

      await expect(controller.delete(id)).rejects.toThrow('Address not found');
      expect(service.delete).toHaveBeenCalledWith(id);
    });
  });

  describe('setDefault', () => {
    it('nên đặt địa chỉ làm mặc định thành công', async () => {
      const dto: AddressSetDefaultDto = {
        addressId: 'addr-123',
        userId: 'user-123',
      };
      const defaultAddress = { ...mockAddressResponse, isDefault: true };
      mockAddressService.setDefaultAddress.mockResolvedValue(defaultAddress);

      const result = await controller.setDefault(dto);

      expect(result).toEqual(defaultAddress);
      expect(result.isDefault).toBe(true);
      expect(service.setDefaultAddress).toHaveBeenCalledWith(dto);
      expect(service.setDefaultAddress).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi địa chỉ không thuộc về user', async () => {
      const dto: AddressSetDefaultDto = {
        addressId: 'addr-123',
        userId: 'wrong-user',
      };
      const error = new Error('Address not found or does not belong to user');
      mockAddressService.setDefaultAddress.mockRejectedValue(error);

      await expect(controller.setDefault(dto)).rejects.toThrow('Address not found or does not belong to user');
      expect(service.setDefaultAddress).toHaveBeenCalledWith(dto);
    });
  });
});
