import { Injectable } from '@nestjs/common';
import { ARSnapshotCreateDto, ARSnapshotListDto } from '@shared/dto/ar.dto';
import { PrismaService } from '@ar-app/prisma/prisma.service';
import {
  ARSnapshotCreateResponse,
  ARSnapshotResponse,
  PaginatedARSnapshotsResponse,
} from '@shared/types/ar.types';
import { ValidationRpcException } from '@shared/exceptions/rpc-exceptions';

@Injectable()
export class ArService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create AR snapshot
   * Saves user's AR photo with product
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
      console.error('[ArService] snapshotCreate error:', error);
      throw new ValidationRpcException('Failed to create AR snapshot');
    }
  }

  /**
   * List AR snapshots with pagination and filters
   * Can filter by userId or productId
   */
  async snapshotList(dto: ARSnapshotListDto): Promise<PaginatedARSnapshotsResponse> {
    try {
      const page = dto.page || 1;
      const pageSize = dto.pageSize || 20;
      const skip = (page - 1) * pageSize;

      // Build where clause
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

      // Execute queries in parallel
      const [snapshots, total] = await Promise.all([
        this.prisma.aRSnapshot.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
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
      console.error('[ArService] snapshotList error:', error);
      throw new ValidationRpcException('Failed to list AR snapshots');
    }
  }

  /**
   * Map Prisma AR snapshot to response
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
