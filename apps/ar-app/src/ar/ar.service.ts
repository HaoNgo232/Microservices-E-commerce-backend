/**
 * AR Microservice Business Logic Layer
 *
 * Xử lý nghiệp vụ liên quan đến AR snapshots:
 * - Lưu AR snapshots (ảnh AR của user)
 * - Lấy danh sách AR snapshots với filter và pagination
 *
 * Database: ar_db (PostgreSQL, riêng biệt từ các service khác)
 * ORM: Prisma
 */

import { Injectable } from '@nestjs/common';
import { ARSnapshotCreateDto, ARSnapshotListDto } from '@shared/dto/ar.dto';
import { PrismaService } from '@ar-app/prisma/prisma.service';
import { ARSnapshotCreateResponse, ARSnapshotResponse, PaginatedARSnapshotsResponse } from '@shared/types/ar.types';
import { ValidationRpcException } from '@shared/exceptions/rpc-exceptions';

@Injectable()
export class ArService {
  /**
   * Inject PrismaService để truy cập database ar_db
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo AR snapshot mới
   *
   * Flow:
   * 1. Validate input từ DTO
   * 2. Lưu snapshot vào database (userId, productId, imageUrl, metadata)
   * 3. Trả về response với id, imageUrl, createdAt
   *
   * @param dto - { userId, productId, imageUrl, metadata }
   * @returns - { id, imageUrl, createdAt }
   * @throws ValidationRpcException - Nếu tạo failed
   */
  async snapshotCreate(dto: ARSnapshotCreateDto): Promise<ARSnapshotCreateResponse> {
    try {
      const snapshot = await this.prisma.aRSnapshot.create({
        data: {
          userId: dto.userId,
          productId: dto.productId,
          imageUrl: dto.imageUrl,
          metadata: dto.metadata as never,
        },
      });

      console.log(`[ArService] Created AR snapshot: ${snapshot.id}`);

      return {
        id: snapshot.id,
        imageUrl: snapshot.imageUrl,
        createdAt: snapshot.createdAt,
      };
    } catch (error) {
      // Re-throw known RPC exceptions
      if (error instanceof ValidationRpcException) {
        throw error;
      }

      // Log error với context
      console.error('[ArService] snapshotCreate error:', {
        userId: dto.userId,
        productId: dto.productId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ValidationRpcException('Failed to create AR snapshot');
    }
  }

  /**
   * Lấy danh sách AR snapshots với filter và pagination
   *
   * Flow:
   * 1. Validate pagination parameters (page, pageSize)
   * 2. Build where clause từ filters (userId, productId)
   * 3. Query snapshots + count total (parallel)
   * 4. Map Prisma objects to response DTOs
   * 5. Trả về paginated response
   *
   * @param dto - { userId?, productId?, page?, pageSize? }
   * @returns - { snapshots[], total, page, pageSize }
   * @throws ValidationRpcException - Nếu query failed
   */
  async snapshotList(dto: ARSnapshotListDto): Promise<PaginatedARSnapshotsResponse> {
    try {
      // Phân trang: mặc định page=1, pageSize=20
      const page = dto.page || 1;
      const pageSize = dto.pageSize || 20;
      const skip = (page - 1) * pageSize;

      // Build where clause từ filters
      const where: {
        userId?: string;
        productId?: string;
      } = {};

      if (dto.userId) {
        where.userId = dto.userId;
      }

      if (dto.productId) {
        where.productId = dto.productId;
      }

      // Query song song: lấy dữ liệu + đếm total
      const [snapshots, total] = await Promise.all([
        this.prisma.aRSnapshot.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' }, // Mới nhất trước
        }),
        this.prisma.aRSnapshot.count({ where }),
      ]);

      return {
        snapshots: snapshots.map(s => this.mapToARSnapshotResponse(s)),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      // Re-throw known RPC exceptions
      if (error instanceof ValidationRpcException) {
        throw error;
      }

      // Log error với context
      console.error('[ArService] snapshotList error:', {
        filters: { userId: dto.userId, productId: dto.productId },
        page: dto.page,
        pageSize: dto.pageSize,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ValidationRpcException('Failed to list AR snapshots');
    }
  }

  /**
   * Helper: Map Prisma ARSnapshot object to response DTO
   *
   * Chuyển đổi từ Prisma model sang response type
   * - Giữ nguyên các field cần thiết
   * - Cast metadata từ Json sang Record
   *
   * @param snapshot - Prisma ARSnapshot object
   * @returns - ARSnapshotResponse DTO
   * @private
   */
  private mapToARSnapshotResponse(snapshot: {
    id: string;
    userId: string | null;
    productId: string;
    imageUrl: string;
    metadata: unknown;
    createdAt: Date;
  }): ARSnapshotResponse {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      productId: snapshot.productId,
      imageUrl: snapshot.imageUrl,
      metadata: snapshot.metadata as Record<string, unknown> | null,
      createdAt: snapshot.createdAt,
    };
  }
}
