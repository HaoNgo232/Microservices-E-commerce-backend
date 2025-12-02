import { RpcException } from '@nestjs/microservices';
import type { BufferedFile } from './minio.service';
import { MinioService } from './minio.service';

describe('MinioService.uploadTryOnImage', () => {
  let service: MinioService;

  beforeEach(() => {
    service = new MinioService();
    jest.spyOn(service['minioClient'], 'putObject').mockResolvedValue(undefined as never);
  });

  const createFile = (overrides: Partial<BufferedFile>): BufferedFile => ({
    fieldname: 'tryOnImage',
    originalname: 'glasses.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('test'),
    ...overrides,
  });

  it('should upload valid PNG and return url and filename with try-on prefix', async () => {
    const file = createFile({});

    const result = await service.uploadTryOnImage(file);

    expect(result).toBeDefined();
    expect(result.filename.startsWith('try-on/')).toBe(true);
    expect(result.url).toContain(result.filename);
  });

  it('should reject non-PNG mimetype', async () => {
    const file = createFile({ mimetype: 'image/jpeg' });

    await expect(service.uploadTryOnImage(file)).rejects.toBeInstanceOf(RpcException);
  });

  it('should reject file larger than 20MB', async () => {
    const file = createFile({ size: 21 * 1024 * 1024 });

    await expect(service.uploadTryOnImage(file)).rejects.toBeInstanceOf(RpcException);
  });
});
