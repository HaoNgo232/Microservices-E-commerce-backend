import { Test, TestingModule } from '@nestjs/testing';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';
import { PrismaService } from '@ar-app/prisma/prisma.service';
import { ARSnapshotCreateDto, ARSnapshotListDto } from '@shared/dto/ar.dto';

describe('ArController', () => {
  let controller: ArController;
  let mockArService: jest.Mocked<ArService>;

  beforeEach(async () => {
    const mockArServiceInstance = {
      snapshotCreate: jest.fn(),
      snapshotList: jest.fn(),
    };

    const mockPrismaService = {
      aRSnapshot: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArController],
      providers: [
        {
          provide: ArService,
          useValue: mockArServiceInstance,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<ArController>(ArController);
    mockArService = module.get(ArService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('snapshotCreate', () => {
    it('should create AR snapshot successfully', async () => {
      const createDto: ARSnapshotCreateDto = {
        userId: 'user-123',
        productId: 'product-456',
        imageUrl: 'https://example.com/snapshot.jpg',
        metadata: { position: 'home', lighting: 'natural' },
      };

      const mockResponse = {
        id: 'snapshot-789',
        userId: createDto.userId,
        productId: createDto.productId,
        imageUrl: createDto.imageUrl,
        metadata: createDto.metadata,
        createdAt: new Date(),
      };

      mockArService.snapshotCreate.mockResolvedValue(mockResponse);

      const result = await controller.snapshotCreate(createDto);

      expect(result).toEqual(mockResponse);
      expect(mockArService.snapshotCreate).toHaveBeenCalledWith(createDto);
      expect(mockArService.snapshotCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle missing metadata', async () => {
      const createDto: ARSnapshotCreateDto = {
        userId: 'user-123',
        productId: 'product-456',
        imageUrl: 'https://example.com/snapshot.jpg',
      };

      const mockResponse = {
        id: 'snapshot-789',
        userId: createDto.userId,
        productId: createDto.productId,
        imageUrl: createDto.imageUrl,
        metadata: null,
        createdAt: new Date(),
      };

      mockArService.snapshotCreate.mockResolvedValue(mockResponse);

      const result = await controller.snapshotCreate(createDto);

      expect(result).toEqual(mockResponse);
      expect(mockArService.snapshotCreate).toHaveBeenCalledWith(createDto);
    });
  });

  describe('snapshotList', () => {
    it('should list AR snapshots with default pagination', async () => {
      const listDto: ARSnapshotListDto = {
        page: 1,
        pageSize: 10,
      };

      const mockSnapshots = [
        {
          id: 'snapshot-1',
          userId: 'user-123',
          productId: 'product-456',
          imageUrl: 'https://example.com/snap1.jpg',
          createdAt: new Date(),
        },
        {
          id: 'snapshot-2',
          userId: 'user-456',
          productId: 'product-789',
          imageUrl: 'https://example.com/snap2.jpg',
          createdAt: new Date(),
        },
      ];

      const mockResponse = {
        snapshots: mockSnapshots,
        total: 2,
        page: 1,
        pageSize: 10,
      };

      mockArService.snapshotList.mockResolvedValue(mockResponse);

      const result = await controller.snapshotList(listDto);

      expect(result).toEqual(mockResponse);
      expect(mockArService.snapshotList).toHaveBeenCalledWith(listDto);
      expect(mockArService.snapshotList).toHaveBeenCalledTimes(1);
    });

    it('should list AR snapshots filtered by userId', async () => {
      const listDto: ARSnapshotListDto = {
        page: 1,
        pageSize: 10,
        userId: 'user-123',
      };

      const mockResponse = {
        snapshots: [
          {
            id: 'snapshot-1',
            userId: 'user-123',
            productId: 'product-456',
            imageUrl: 'https://example.com/snap1.jpg',
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockArService.snapshotList.mockResolvedValue(mockResponse);

      const result = await controller.snapshotList(listDto);

      expect(result).toEqual(mockResponse);
      expect(mockArService.snapshotList).toHaveBeenCalledWith(listDto);
    });

    it('should list AR snapshots filtered by productId', async () => {
      const listDto: ARSnapshotListDto = {
        page: 1,
        pageSize: 10,
        productId: 'product-456',
      };

      const mockResponse = {
        snapshots: [
          {
            id: 'snapshot-1',
            userId: 'user-123',
            productId: 'product-456',
            imageUrl: 'https://example.com/snap1.jpg',
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockArService.snapshotList.mockResolvedValue(mockResponse);

      const result = await controller.snapshotList(listDto);

      expect(result).toEqual(mockResponse);
      expect(mockArService.snapshotList).toHaveBeenCalledWith(listDto);
    });

    it('should return empty list when no snapshots found', async () => {
      const listDto: ARSnapshotListDto = {
        page: 1,
        pageSize: 10,
      };

      const mockResponse = {
        snapshots: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };

      mockArService.snapshotList.mockResolvedValue(mockResponse);

      const result = await controller.snapshotList(listDto);

      expect(result).toEqual(mockResponse);
      expect(result.snapshots).toHaveLength(0);
    });

    it('should handle custom page size', async () => {
      const listDto: ARSnapshotListDto = {
        page: 2,
        pageSize: 5,
      };

      const mockResponse = {
        snapshots: [],
        total: 12,
        page: 2,
        pageSize: 5,
      };

      mockArService.snapshotList.mockResolvedValue(mockResponse);

      const result = await controller.snapshotList(listDto);

      expect(result).toEqual(mockResponse);
      expect(mockArService.snapshotList).toHaveBeenCalledWith(listDto);
    });
  });
});
