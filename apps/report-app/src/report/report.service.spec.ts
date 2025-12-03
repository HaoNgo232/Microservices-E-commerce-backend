import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { PrismaService } from '@report-app/prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import { ValidationRpcException } from '@shared/exceptions/rpc-exceptions';

describe('ReportService', () => {
  let service: ReportService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockOrderClient: jest.Mocked<ClientProxy>;
  let mockUserClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const mockPrismaService = {
      reportEntry: {
        create: jest.fn().mockResolvedValue({ id: 'report-1' }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const mockClientProxy = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'ORDER_SERVICE',
          useValue: mockClientProxy,
        },
        {
          provide: 'USER_SERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    mockPrisma = module.get(PrismaService);
    mockOrderClient = module.get('ORDER_SERVICE');
    mockUserClient = module.get('USER_SERVICE');

    // Mock console.log và console.error để không spam test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mockPrisma).toBeDefined();
    expect(mockOrderClient).toBeDefined();
    expect(mockUserClient).toBeDefined();
  });

  describe('salesSummary', () => {
    const validDto = {
      fromAt: '2024-01-01T00:00:00Z',
      toAt: '2024-01-31T23:59:59Z',
    };

    it('should generate sales summary successfully', async () => {
      const result = await service.salesSummary(validDto);

      expect(result).toMatchObject({
        totalOrders: 150,
        totalRevenueInt: 45000000,
        averageOrderValueInt: 300000,
      });
      expect(result.fromAt).toBeInstanceOf(Date);
      expect(result.toAt).toBeInstanceOf(Date);
      expect(mockPrisma.reportEntry.create).toHaveBeenCalledWith({
        data: {
          type: 'SALES_SUMMARY',
          payload: expect.any(Object),
          fromAt: expect.any(Date),
          toAt: expect.any(Date),
        },
      });
    });

    it('should throw ValidationRpcException if fromAt > toAt', async () => {
      const invalidDto = {
        fromAt: '2024-01-31T23:59:59Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      await expect(service.salesSummary(invalidDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.salesSummary(invalidDto)).rejects.toThrow('fromAt must be before toAt');
      expect(mockPrisma.reportEntry.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationRpcException on database error', async () => {
      (mockPrisma.reportEntry.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.salesSummary(validDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.salesSummary(validDto)).rejects.toThrow('Failed to generate sales summary');
    });

    it('should handle same fromAt and toAt dates', async () => {
      const sameDateDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      const result = await service.salesSummary(sameDateDto);

      expect(result).toBeDefined();
      expect(mockPrisma.reportEntry.create).toHaveBeenCalled();
    });
  });

  describe('productPerformance', () => {
    const validDto = {
      fromAt: '2024-01-01T00:00:00Z',
      toAt: '2024-01-31T23:59:59Z',
    };

    it('should generate product performance report successfully', async () => {
      const result = await service.productPerformance(validDto);

      expect(result).toMatchObject({
        products: expect.arrayContaining([
          expect.objectContaining({
            productId: 'prod-1',
            productName: 'Product A',
            totalQuantitySold: 50,
            totalRevenueInt: 10000000,
          }),
          expect.objectContaining({
            productId: 'prod-2',
            productName: 'Product B',
            totalQuantitySold: 30,
            totalRevenueInt: 6000000,
          }),
        ]),
      });
      expect(result.fromAt).toBeInstanceOf(Date);
      expect(result.toAt).toBeInstanceOf(Date);
      expect(mockPrisma.reportEntry.create).toHaveBeenCalledWith({
        data: {
          type: 'PRODUCT_PERFORMANCE',
          payload: expect.any(Object),
          fromAt: expect.any(Date),
          toAt: expect.any(Date),
        },
      });
    });

    it('should throw ValidationRpcException if fromAt > toAt', async () => {
      const invalidDto = {
        fromAt: '2024-01-31T23:59:59Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      await expect(service.productPerformance(invalidDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.productPerformance(invalidDto)).rejects.toThrow('fromAt must be before toAt');
      expect(mockPrisma.reportEntry.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationRpcException on database error', async () => {
      (mockPrisma.reportEntry.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.productPerformance(validDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.productPerformance(validDto)).rejects.toThrow(
        'Failed to generate product performance report',
      );
    });

    it('should handle same fromAt and toAt dates', async () => {
      const sameDateDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      const result = await service.productPerformance(sameDateDto);

      expect(result).toBeDefined();
      expect(mockPrisma.reportEntry.create).toHaveBeenCalled();
    });
  });

  describe('userCohort', () => {
    const validDto = {
      fromAt: '2024-01-01T00:00:00Z',
      toAt: '2024-01-31T23:59:59Z',
    };

    it('should generate user cohort report successfully', async () => {
      const result = await service.userCohort(validDto);

      expect(result).toMatchObject({
        newUsers: 25,
        activeUsers: 120,
        returningCustomers: 80,
      });
      expect(result.fromAt).toBeInstanceOf(Date);
      expect(result.toAt).toBeInstanceOf(Date);
      expect(mockPrisma.reportEntry.create).toHaveBeenCalledWith({
        data: {
          type: 'USER_COHORT',
          payload: expect.any(Object),
          fromAt: expect.any(Date),
          toAt: expect.any(Date),
        },
      });
    });

    it('should throw ValidationRpcException if fromAt > toAt', async () => {
      const invalidDto = {
        fromAt: '2024-01-31T23:59:59Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      await expect(service.userCohort(invalidDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.userCohort(invalidDto)).rejects.toThrow('fromAt must be before toAt');
      expect(mockPrisma.reportEntry.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationRpcException on database error', async () => {
      (mockPrisma.reportEntry.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.userCohort(validDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.userCohort(validDto)).rejects.toThrow('Failed to generate user cohort report');
    });

    it('should handle same fromAt and toAt dates', async () => {
      const sameDateDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      const result = await service.userCohort(sameDateDto);

      expect(result).toBeDefined();
      expect(mockPrisma.reportEntry.create).toHaveBeenCalled();
    });
  });
});
