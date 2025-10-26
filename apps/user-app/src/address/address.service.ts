import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  AddressCreateDto,
  AddressUpdateDto,
  AddressListByUserDto,
  AddressSetDefaultDto,
} from '@shared/dto/address.dto';
import { AddressResponse } from '@shared/types/address.types';
import { PrismaService } from '@user-app/prisma/prisma.service';

export interface IAddressService {
  listByUser(dto: AddressListByUserDto): Promise<AddressResponse[]>;
  create(payload: { userId: string; dto: AddressCreateDto }): Promise<AddressResponse>;
  update(id: string, dto: AddressUpdateDto): Promise<AddressResponse>;
  delete(id: string): Promise<{ success: boolean; message: string }>;
  setDefaultAddress(dto: AddressSetDefaultDto): Promise<AddressResponse>;
}

@Injectable()
export class AddressService implements IAddressService {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(dto: AddressListByUserDto): Promise<AddressResponse[]> {
    try {
      const addresses = await this.prisma.address.findMany({
        where: { userId: dto.userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return addresses;
    } catch (error) {
      console.error('[AddressService] listByUser error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Không thể lấy danh sách địa chỉ',
      });
    }
  }

  async create(payload: { userId: string; dto: AddressCreateDto }): Promise<AddressResponse> {
    try {
      const { userId, dto } = payload;

      // Kiểm tra user có tồn tại không
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!userExists) {
        throw new RpcException({
          statusCode: 404,
          message: `Người dùng ${userId} không tồn tại`,
        });
      }

      // Kiểm tra xem user đã có địa chỉ nào chưa
      const existingAddressCount = await this.prisma.address.count({
        where: { userId },
      });

      // LOGIC QUAN TRỌNG: Địa chỉ đầu tiên tự động là default
      // Dù client set isDefault: false, địa chỉ đầu tiên LUÔN là default
      const isFirstAddress = existingAddressCount === 0;
      const shouldBeDefault = isFirstAddress || dto.isDefault;

      // QUAN TRỌNG: Chỉ được có 1 địa chỉ mặc định cho mỗi user
      // Nếu đánh dấu địa chỉ mới là mặc định → bỏ mặc định tất cả địa chỉ cũ
      if (shouldBeDefault) {
        await this.prisma.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      // Tạo địa chỉ mới
      const address = await this.prisma.address.create({
        data: {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          street: dto.street,
          ward: dto.ward,
          district: dto.district,
          city: dto.city,
          isDefault: shouldBeDefault,
        },
      });

      return address;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[AddressService] create error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Không thể tạo địa chỉ',
      });
    }
  }

  async update(id: string, dto: AddressUpdateDto): Promise<AddressResponse> {
    try {
      // Kiểm tra địa chỉ có tồn tại không
      const existingAddress = await this.prisma.address.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });

      if (!existingAddress) {
        throw new RpcException({
          statusCode: 404,
          message: `Địa chỉ ${id} không tồn tại`,
        });
      }

      // Nếu cập nhật thành địa chỉ mặc định, bỏ mặc định của các địa chỉ khác
      if (dto.isDefault) {
        await this.prisma.address.updateMany({
          where: { userId: existingAddress.userId, id: { not: id } },
          data: { isDefault: false },
        });
      }

      // Cập nhật địa chỉ
      const updatedAddress = await this.prisma.address.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          street: dto.street,
          ward: dto.ward,
          district: dto.district,
          city: dto.city,
          isDefault: dto.isDefault,
        },
      });

      return updatedAddress;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[AddressService] update error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Không thể cập nhật địa chỉ',
      });
    }
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    try {
      // Kiểm tra địa chỉ có tồn tại không
      const existingAddress = await this.prisma.address.findUnique({
        where: { id },
        select: { id: true, isDefault: true, userId: true },
      });

      if (!existingAddress) {
        throw new RpcException({
          statusCode: 404,
          message: `Địa chỉ ${id} không tồn tại`,
        });
      }

      // Xóa địa chỉ
      await this.prisma.address.delete({
        where: { id },
      });

      // LOGIC QUAN TRỌNG: Auto-assign địa chỉ mặc định mới
      // Nếu xóa địa chỉ mặc định → tự động chọn địa chỉ cũ nhất còn lại làm mặc định
      // Tránh trường hợp user không có địa chỉ mặc định
      if (existingAddress.isDefault) {
        const firstAddress = await this.prisma.address.findFirst({
          where: { userId: existingAddress.userId },
          orderBy: { createdAt: 'asc' }, // Lấy địa chỉ tạo đầu tiên
        });

        if (firstAddress) {
          await this.prisma.address.update({
            where: { id: firstAddress.id },
            data: { isDefault: true },
          });
        }
      }

      return {
        success: true,
        message: 'Đã xóa địa chỉ thành công',
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[AddressService] delete error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Không thể xóa địa chỉ',
      });
    }
  }

  async setDefaultAddress(dto: AddressSetDefaultDto): Promise<AddressResponse> {
    try {
      // Kiểm tra địa chỉ có tồn tại và thuộc về user không
      const existingAddress = await this.prisma.address.findFirst({
        where: {
          id: dto.addressId,
          userId: dto.userId,
        },
        select: { id: true, userId: true },
      });

      if (!existingAddress) {
        throw new RpcException({
          statusCode: 404,
          message: `Địa chỉ ${dto.addressId} không tồn tại hoặc không thuộc về người dùng này`,
        });
      }

      // Bỏ mặc định của tất cả địa chỉ khác
      await this.prisma.address.updateMany({
        where: { userId: dto.userId },
        data: { isDefault: false },
      });

      // Set địa chỉ này làm mặc định
      const updatedAddress = await this.prisma.address.update({
        where: { id: dto.addressId },
        data: { isDefault: true },
      });

      return updatedAddress;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[AddressService] setDefaultAddress error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Không thể đặt địa chỉ mặc định',
      });
    }
  }
}
