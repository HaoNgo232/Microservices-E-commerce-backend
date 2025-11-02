import { Test, TestingModule } from '@nestjs/testing';
import { ArService } from './ar.service';
import { PrismaService } from '@ar-app/prisma/prisma.service';
import { ValidationRpcException } from '@shared/exceptions/rpc-exceptions';

describe('ArService', () => {
  let service: ArService;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      aRSnapshot: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ArService>(ArService);
    mockPrisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('snapshotCreate', () => {
    const mockCreateDto = {
      userId: 'user-123',
      productId: 'product-456',
      imageUrl: 'https://example.com/ar-snapshot.jpg',
      metadata: { rotation: 45, position: 'center' },
    };

    it('should create AR snapshot with userId and metadata', async () => {
      const mockSnapshot = {
        id: 'snapshot-123',
        userId: mockCreateDto.userId,
        productId: mockCreateDto.productId,
        imageUrl: mockCreateDto.imageUrl,
        metadata: mockCreateDto.metadata,
        createdAt: new Date(),
      };

      (mockPrisma.aRSnapshot.create as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await service.snapshotCreate(mockCreateDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('snapshot-123');
      expect(result.imageUrl).toBe(mockCreateDto.imageUrl);
      expect(result.createdAt).toBeDefined();
      expect(mockPrisma.aRSnapshot.create).toHaveBeenCalledWith({
        data: {
          userId: mockCreateDto.userId,
          productId: mockCreateDto.productId,
          imageUrl: mockCreateDto.imageUrl,
          metadata: mockCreateDto.metadata,
        },
      });
    });

    it('should create AR snapshot without userId (anonymous)', async () => {
      const dtoWithoutUserId = {
        productId: 'product-456',
        imageUrl: 'https://example.com/ar-snapshot.jpg',
      };

      const mockSnapshot = {
        id: 'snapshot-123',
        userId: null,
        productId: dtoWithoutUserId.productId,
        imageUrl: dtoWithoutUserId.imageUrl,
        metadata: null,
        createdAt: new Date(),
      };

      (mockPrisma.aRSnapshot.create as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await service.snapshotCreate(dtoWithoutUserId);

      expect(result).toBeDefined();
      expect(mockPrisma.aRSnapshot.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          productId: dtoWithoutUserId.productId,
          imageUrl: dtoWithoutUserId.imageUrl,
          metadata: undefined,
        },
      });
    });

    it('should create AR snapshot without metadata', async () => {
      const dtoWithoutMetadata = {
        userId: 'user-123',
        productId: 'product-456',
        imageUrl: 'https://example.com/ar-snapshot.jpg',
      };

      const mockSnapshot = {
        id: 'snapshot-123',
        userId: dtoWithoutMetadata.userId,
        productId: dtoWithoutMetadata.productId,
        imageUrl: dtoWithoutMetadata.imageUrl,
        metadata: null,
        createdAt: new Date(),
      };

      (mockPrisma.aRSnapshot.create as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await service.snapshotCreate(dtoWithoutMetadata);

      expect(result).toBeDefined();
      expect(result.id).toBe('snapshot-123');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      (mockPrisma.aRSnapshot.create as jest.Mock).mockRejectedValue(error);

      await expect(service.snapshotCreate(mockCreateDto)).rejects.toThrow(ValidationRpcException);

      expect(mockPrisma.aRSnapshot.create).toHaveBeenCalled();
    });

    it('should throw ValidationRpcException when Prisma throws error', async () => {
      const error = new Error('Unique constraint violation');
      (mockPrisma.aRSnapshot.create as jest.Mock).mockRejectedValue(error);

      try {
        await service.snapshotCreate(mockCreateDto);
        fail('Should have thrown ValidationRpcException');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationRpcException);
        expect(e.message).toBe('Failed to create AR snapshot');
      }
    });

    it('should re-throw ValidationRpcException from Prisma', async () => {
      const validationError = new ValidationRpcException('Invalid product ID');
      (mockPrisma.aRSnapshot.create as jest.Mock).mockRejectedValue(validationError);

      await expect(service.snapshotCreate(mockCreateDto)).rejects.toThrow(ValidationRpcException);
    });
  });

  describe('snapshotList', () => {
    const mockSnapshot = {
      id: 'snapshot-123',
      userId: 'user-123',
      productId: 'product-456',
      imageUrl: 'https://example.com/ar-snapshot.jpg',
      metadata: { rotation: 45 },
      createdAt: new Date(),
    };

    it('should list all snapshots without filters', async () => {
      const mockSnapshots = [mockSnapshot, { ...mockSnapshot, id: 'snapshot-456' }];
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(2);

      const result = await service.snapshotList({ page: 1, pageSize: 20 });

      expect(result).toBeDefined();
      expect(result.snapshots).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(mockPrisma.aRSnapshot.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.aRSnapshot.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should filter snapshots by userId', async () => {
      const filteredSnapshots = [mockSnapshot];
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue(filteredSnapshots);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(1);

      const result = await service.snapshotList({
        userId: 'user-123',
        page: 1,
        pageSize: 20,
      });

      expect(result).toBeDefined();
      expect(result.snapshots).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.aRSnapshot.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.aRSnapshot.count).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
    });

    it('should filter snapshots by productId', async () => {
      const filteredSnapshots = [mockSnapshot];
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue(filteredSnapshots);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(1);

      const result = await service.snapshotList({
        productId: 'product-456',
        page: 1,
        pageSize: 20,
      });

      expect(result).toBeDefined();
      expect(result.snapshots).toHaveLength(1);
      expect(mockPrisma.aRSnapshot.findMany).toHaveBeenCalledWith({
        where: { productId: 'product-456' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter snapshots by both userId and productId', async () => {
      const filteredSnapshots = [mockSnapshot];
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue(filteredSnapshots);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(1);

      const result = await service.snapshotList({
        userId: 'user-123',
        productId: 'product-456',
        page: 1,
        pageSize: 20,
      });

      expect(result).toBeDefined();
      expect(mockPrisma.aRSnapshot.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', productId: 'product-456' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.aRSnapshot.count).toHaveBeenCalledWith({
        where: { userId: 'user-123', productId: 'product-456' },
      });
    });

    it('should support pagination with custom page and pageSize', async () => {
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue([mockSnapshot]);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(5);

      const result = await service.snapshotList({
        page: 2,
        pageSize: 2,
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(2);
      expect(result.total).toBe(5);
      expect(mockPrisma.aRSnapshot.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 2, // (2-1) * 2 = 2
        take: 2,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should use default pagination values when not provided', async () => {
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue([mockSnapshot]);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(1);

      const result = await service.snapshotList({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(mockPrisma.aRSnapshot.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty list when no snapshots found', async () => {
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(0);

      const result = await service.snapshotList({
        userId: 'non-existent-user',
        page: 1,
        pageSize: 20,
      });

      expect(result.snapshots).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should handle database errors during listing', async () => {
      const error = new Error('Database query failed');
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockRejectedValue(error);

      await expect(
        service.snapshotList({
          page: 1,
          pageSize: 20,
        }),
      ).rejects.toThrow(ValidationRpcException);
    });

    it('should throw ValidationRpcException when Prisma throws error', async () => {
      const error = new Error('Connection timeout');
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockRejectedValue(error);

      try {
        await service.snapshotList({ page: 1, pageSize: 20 });
        fail('Should have thrown ValidationRpcException');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationRpcException);
        expect(e.message).toBe('Failed to list AR snapshots');
      }
    });

    it('should re-throw ValidationRpcException from Prisma during listing', async () => {
      const validationError = new ValidationRpcException('Invalid filter');
      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockRejectedValue(validationError);

      await expect(service.snapshotList({ page: 1, pageSize: 20 })).rejects.toThrow(ValidationRpcException);
    });

    it('should handle metadata mapping correctly', async () => {
      const snapshotWithMetadata = {
        id: 'snapshot-123',
        userId: 'user-123',
        productId: 'product-456',
        imageUrl: 'https://example.com/ar-snapshot.jpg',
        metadata: { rotation: 45, position: { x: 10, y: 20, z: 30 } },
        createdAt: new Date(),
      };

      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue([snapshotWithMetadata]);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(1);

      const result = await service.snapshotList({ page: 1, pageSize: 20 });

      expect(result.snapshots[0].metadata).toEqual(snapshotWithMetadata.metadata);
    });

    it('should handle null metadata', async () => {
      const snapshotWithoutMetadata = {
        ...mockSnapshot,
        metadata: null,
      };

      (mockPrisma.aRSnapshot.findMany as jest.Mock).mockResolvedValue([snapshotWithoutMetadata]);
      (mockPrisma.aRSnapshot.count as jest.Mock).mockResolvedValue(1);

      const result = await service.snapshotList({ page: 1, pageSize: 20 });

      expect(result.snapshots[0].metadata).toBeNull();
    });
  });
});
