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

/**
 * Interface cho Address Service
 * Định nghĩa các phương thức quản lý shipping addresses
 */
export interface IAddressService {
  /**
   * Lấy danh sách addresses của user
   */
  listByUser(dto: AddressListByUserDto): Promise<AddressResponse[]>;

  /**
   * Lấy chi tiết address theo ID
   */
  getById(id: string): Promise<AddressResponse>;

  /**
   * Tạo address mới
   */
  create(payload: { userId: string; dto: AddressCreateDto }): Promise<AddressResponse>;

  /**
   * Cập nhật address
   */
  update(id: string, dto: AddressUpdateDto): Promise<AddressResponse>;

  /**
   * Xóa address
   */
  delete(id: string): Promise<{ success: boolean; message: string }>;

  /**
   * Đặt address làm mặc định
   */
  setDefaultAddress(dto: AddressSetDefaultDto): Promise<AddressResponse>;
}

/**
 * AddressService - Service quản lý shipping addresses
 *
 * Xử lý business logic liên quan đến:
 * - Lấy danh sách addresses của user (default lên đầu)
 * - Tạo address mới (auto-set default nếu là địa chỉ đầu tiên)
 * - Cập nhật address (handle default flag)
 * - Xóa address (auto-assign default mới nếu xóa default)
 * - Set address làm default (unset các addresses khác)
 *
 * **Business Rules:**
 * - Địa chỉ đầu tiên của user tự động là default
 * - Chỉ có 1 địa chỉ default cho mỗi user
 * - Khi xóa địa chỉ default, tự động chọn địa chỉ cũ nhất làm default
 */
@Injectable()
export class AddressService implements IAddressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách addresses của user
   *
   * Sắp xếp:
   * 1. Địa chỉ default lên đầu (isDefault: desc)
   * 2. Địa chỉ mới nhất lên đầu (createdAt: desc)
   *
   * @param dto - { userId }
   * @returns Danh sách addresses
   * @throws RpcException nếu có lỗi database
   */
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

  /**
   * Lấy chi tiết address theo ID
   *
   * @param id - Address ID
   * @returns Address details
   * @throws RpcException nếu address không tồn tại hoặc có lỗi database
   */
  async getById(id: string): Promise<AddressResponse> {
    try {
      const address = await this.prisma.address.findUnique({
        where: { id },
      });

      if (!address) {
        throw new RpcException({
          statusCode: 404,
          message: `Địa chỉ ${id} không tồn tại`,
        });
      }

      return address;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[AddressService] getById error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Không thể lấy thông tin địa chỉ',
      });
    }
  }

  /**
   * Tạo address mới cho user
   *
   * **Business Rules:**
   * 1. Validate user tồn tại
   * 2. Kiểm tra số lượng addresses hiện có
   * 3. Địa chỉ đầu tiên TỰ ĐỘNG là default (bất kể client set gì)
   * 4. Nếu set isDefault=true → bỏ default tất cả addresses khác
   *
   * @param payload - { userId, dto }
   * @returns Address đã tạo
   * @throws RpcException nếu user không tồn tại hoặc có lỗi database
   */
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

      // Lưu ý: Địa chỉ đầu tiên sẽ tự động được đặt làm default
      // Dù client set isDefault: false, địa chỉ đầu tiên LUÔN là default
      const isFirstAddress = existingAddressCount === 0;
      const shouldBeDefault = isFirstAddress || dto.isDefault;

      // Lưu ý: Mỗi user chỉ được có một địa chỉ mặc định
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

  /**
   * Cập nhật address
   *
   * **Business Rules:**
   * 1. Validate address tồn tại
   * 2. Nếu set isDefault=true → bỏ default của addresses khác
   * 3. Cho phép cập nhật partial data (chỉ fields được truyền)
   *
   * @param id - Address ID
   * @param dto - Dữ liệu cập nhật (partial)
   * @returns Address đã cập nhật
   * @throws RpcException nếu address không tồn tại hoặc có lỗi database
   */
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
      if (dto?.isDefault) {
        await this.prisma.address.updateMany({
          where: { userId: existingAddress.userId, id: { not: id } },
          data: { isDefault: false },
        });
      }

      // Build update data - chỉ include fields được cung cấp
      const updateData: Partial<AddressUpdateDto> = {};
      if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
      if (dto.phone !== undefined) updateData.phone = dto.phone;
      if (dto.street !== undefined) updateData.street = dto.street;
      if (dto.ward !== undefined) updateData.ward = dto.ward;
      if (dto.district !== undefined) updateData.district = dto.district;
      if (dto.city !== undefined) updateData.city = dto.city;
      if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;

      // Cập nhật địa chỉ
      const updatedAddress = await this.prisma.address.update({
        where: { id },
        data: updateData,
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

  /**
   * Xóa address
   *
   * **Business Rules:**
   * 1. Validate address tồn tại
   * 2. Xóa address
   * 3. Nếu xóa default address → tự động chọn địa chỉ cũ nhất còn lại làm default
   *    (tránh trường hợp user không có địa chỉ mặc định)
   *
   * @param id - Address ID
   * @returns Success message
   * @throws RpcException nếu address không tồn tại hoặc có lỗi database
   */
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
          message: `Địa chỉ ${id} vốn dĩ không tồn tại hoặc đã bị xóa`,
        });
      }

      // Xóa địa chỉ
      await this.prisma.address.delete({
        where: { id },
      });

      // Lưu ý: Gán tự động địa chỉ mặc định khi cần
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

  /**
   * Đặt address làm mặc định
   *
   * **Business Rules:**
   * 1. Validate address tồn tại và thuộc về user
   * 2. Bỏ default của TẤT CẢ addresses khác của user
   * 3. Set address này làm default
   *
   * @param dto - { userId, addressId }
   * @returns Address đã set làm default
   * @throws RpcException nếu address không tồn tại hoặc không thuộc về user
   */
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
