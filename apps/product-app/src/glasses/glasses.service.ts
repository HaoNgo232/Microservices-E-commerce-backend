import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { Prisma } from '../../prisma/generated/client';
import {
  GlassesModelIdDto,
  GlassesModelCreateDto,
  GlassesModelUpdateDto,
} from '@shared/dto/glasses.dto';
import { GlassesModelResponse, GlassesModelDownloadResponse } from '@shared/types/glasses.types';
import { PrismaService } from '@product-app/prisma/prisma.service';
import { MinioService } from '@product-app/minio/minio.service';
import { EntityNotFoundRpcException, InternalServerRpcException } from '@shared/main';
import { MINIO_CONFIG, BUCKET_NAME } from '@product-app/minio/minio.config';

export interface IGlassesService {
  list(): Promise<GlassesModelResponse[]>;
  getById(dto: GlassesModelIdDto): Promise<GlassesModelResponse>;
  downloadModel(dto: GlassesModelIdDto): Promise<GlassesModelDownloadResponse>;
}

@Injectable()
export class GlassesService implements IGlassesService {
  private readonly GLASSES_BUCKET = 'glasses-models';

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * List all glasses models
   */
  async list(): Promise<GlassesModelResponse[]> {
    try {
      const models = await this.prisma.glassesModel.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return models.map(this.mapToResponse);
    } catch (error) {
      throw new InternalServerRpcException(
        `Failed to list glasses models: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get glasses model by ID
   * @throws RpcException if model not found
   */
  async getById(dto: GlassesModelIdDto): Promise<GlassesModelResponse> {
    try {
      const model = await this.prisma.glassesModel.findUnique({
        where: { id: dto.id },
      });

      if (!model) {
        throw new EntityNotFoundRpcException(`Glasses model with ID ${dto.id} not found`);
      }

      return this.mapToResponse(model);
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new InternalServerRpcException(
        `Failed to get glasses model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get download URL for GLB model file
   * Returns presigned URL or direct download URL from MinIO
   */
  async downloadModel(dto: GlassesModelIdDto): Promise<GlassesModelDownloadResponse> {
    try {
      const model = await this.prisma.glassesModel.findUnique({
        where: { id: dto.id },
      });

      if (!model) {
        throw new EntityNotFoundRpcException(`Glasses model with ID ${dto.id} not found`);
      }

      if (!model.model3dUrl) {
        throw new RpcException({
          statusCode: 404,
          message: 'Model 3D file not available for this glasses model',
        });
      }

      // Return the stored URL (could be presigned URL or direct URL)
      // If backend generates presigned URLs, generate it here
      return {
        url: model.model3dUrl,
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new InternalServerRpcException(
        `Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Map Prisma model to response type
   */
  private mapToResponse(model: Prisma.GlassesModelGetPayload<Record<string, never>>): GlassesModelResponse {
    return {
      id: model.id,
      name: model.name,
      description: model.description,
      thumbnailUrl: model.thumbnailUrl,
      model3dUrl: model.model3dUrl,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    };
  }
}

