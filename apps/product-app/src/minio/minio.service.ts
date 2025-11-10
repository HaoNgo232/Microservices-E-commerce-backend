import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { MINIO_CONFIG, BUCKET_NAME } from './minio.config';
import { RpcException } from '@nestjs/microservices';

export interface BufferedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadedFileResponse {
  url: string;
  filename: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly minioClient: Minio.Client;

  constructor() {
    this.minioClient = new Minio.Client(MINIO_CONFIG);
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    const exists = await this.minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await this.minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      // Set public read policy
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await this.minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    }
  }

  async uploadImage(file: BufferedFile): Promise<UploadedFileResponse> {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
      });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new RpcException({
        statusCode: 400,
        message: 'File size exceeds 5MB limit.',
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop();
    const filename = `products/${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Upload to MinIO
    await this.minioClient.putObject(BUCKET_NAME, filename, file.buffer, file.size, { 'Content-Type': file.mimetype });

    // Return public URL
    const url = `http://${MINIO_CONFIG.endPoint}:${MINIO_CONFIG.port}/${BUCKET_NAME}/${filename}`;
    return { url, filename };
  }

  async deleteImage(filename: string): Promise<void> {
    try {
      await this.minioClient.removeObject(BUCKET_NAME, filename);
    } catch (error) {
      console.error('Failed to delete image from MinIO:', error);
      // Don't throw - allow operation to continue even if delete fails
    }
  }
}
