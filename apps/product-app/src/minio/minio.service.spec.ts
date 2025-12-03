import { RpcException } from '@nestjs/microservices';
import type { BufferedFile } from './minio.service';
import { MinioService } from './minio.service';
import * as Minio from 'minio';

// Mock Minio client
jest.mock('minio');

describe('MinioService', () => {
  let service: MinioService;
  let mockMinioClient: {
    bucketExists: jest.Mock;
    makeBucket: jest.Mock;
    setBucketPolicy: jest.Mock;
    putObject: jest.Mock;
    removeObject: jest.Mock;
  };

  const createFile = (overrides: Partial<BufferedFile>): BufferedFile => ({
    fieldname: 'image',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test'),
    ...overrides,
  });

  beforeEach(() => {
    mockMinioClient = {
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      setBucketPolicy: jest.fn(),
      putObject: jest.fn(),
      removeObject: jest.fn(),
    };

    (Minio.Client as jest.Mock).mockImplementation(() => mockMinioClient);

    service = new MinioService();
    (service as unknown as { minioClient: typeof mockMinioClient }).minioClient = mockMinioClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should create bucket if it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);
      mockMinioClient.setBucketPolicy.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalled();
      expect(mockMinioClient.makeBucket).toHaveBeenCalled();
      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalled();
    });

    it('should not create bucket if it already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalled();
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
      expect(mockMinioClient.setBucketPolicy).not.toHaveBeenCalled();
    });
  });

  describe('uploadImage', () => {
    it('should upload valid image and return url and filename', async () => {
      const file = createFile({ mimetype: 'image/jpeg' });
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const result = await service.uploadImage(file);

      expect(result).toBeDefined();
      expect(result.filename).toMatch(/^products\/\d+-[a-z0-9]+\.jpg$/);
      expect(result.url).toContain(result.filename);
      expect(mockMinioClient.putObject).toHaveBeenCalled();
    });

    it('should accept JPEG, PNG, and WebP formats', async () => {
      const formats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      mockMinioClient.putObject.mockResolvedValue(undefined);

      for (const format of formats) {
        const file = createFile({ mimetype: format });
        const result = await service.uploadImage(file);
        expect(result).toBeDefined();
      }
    });

    it('should reject invalid file type', async () => {
      const file = createFile({ mimetype: 'application/pdf' });

      await expect(service.uploadImage(file)).rejects.toThrow(RpcException);
      await expect(service.uploadImage(file)).rejects.toThrow('Invalid file type');
    });

    it('should reject file larger than 5MB', async () => {
      const file = createFile({ size: 6 * 1024 * 1024 });

      await expect(service.uploadImage(file)).rejects.toThrow(RpcException);
      await expect(service.uploadImage(file)).rejects.toThrow('File size exceeds 5MB limit');
    });

    it('should handle file with no extension', async () => {
      const file = createFile({ originalname: 'test' });
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const result = await service.uploadImage(file);

      expect(result.filename).toBeDefined();
      expect(mockMinioClient.putObject).toHaveBeenCalled();
    });
  });

  describe('uploadTryOnImage', () => {
    it('should upload valid PNG and return url and filename with try-on prefix', async () => {
      const file = createFile({ mimetype: 'image/png', originalname: 'glasses.png' });
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const result = await service.uploadTryOnImage(file);

      expect(result).toBeDefined();
      expect(result.filename.startsWith('try-on/')).toBe(true);
      expect(result.filename.endsWith('.png')).toBe(true);
      expect(result.url).toContain(result.filename);
      expect(mockMinioClient.putObject).toHaveBeenCalled();
    });

    it('should reject non-PNG mimetype', async () => {
      const file = createFile({ mimetype: 'image/jpeg' });

      await expect(service.uploadTryOnImage(file)).rejects.toThrow(RpcException);
      await expect(service.uploadTryOnImage(file)).rejects.toThrow('Invalid file type for try-on image');
    });

    it('should reject file larger than 20MB', async () => {
      const file = createFile({ mimetype: 'image/png', size: 21 * 1024 * 1024 });

      await expect(service.uploadTryOnImage(file)).rejects.toThrow(RpcException);
      await expect(service.uploadTryOnImage(file)).rejects.toThrow('Try-on file size exceeds');
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      const filename = 'products/test.jpg';
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.deleteImage(filename);

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(expect.any(String), filename);
    });

    it('should not throw error when delete fails', async () => {
      const filename = 'products/nonexistent.jpg';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockMinioClient.removeObject.mockRejectedValue(new Error('File not found'));

      await expect(service.deleteImage(filename)).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete image from MinIO:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
