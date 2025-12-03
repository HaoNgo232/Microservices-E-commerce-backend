import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { PrismaService } from '@report-app/prisma/prisma.service';

describe('ReportController', () => {
  let controller: ReportController;
  let mockReportService: jest.Mocked<ReportService>;

  beforeEach(async () => {
    const mockReportServiceInstance = {
      salesSummary: jest.fn(),
      productPerformance: jest.fn(),
      userCohort: jest.fn(),
    };

    const mockPrismaService = {
      reportEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const mockClientProxy = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: ReportService,
          useValue: mockReportServiceInstance,
        },
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

    controller = module.get<ReportController>(ReportController);
    mockReportService = module.get(ReportService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(mockReportService).toBeDefined();
  });

  describe('salesSummary', () => {
    it('should call ReportService.salesSummary and return result', async () => {
      // Arrange
      const dto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-01-31T23:59:59Z',
      };
      const mockResponse = {
        totalOrders: 150,
        totalRevenueInt: 45000000,
        averageOrderValueInt: 300000,
        fromAt: new Date('2024-01-01T00:00:00Z'),
        toAt: new Date('2024-01-31T23:59:59Z'),
      };
      mockReportService.salesSummary.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.salesSummary(dto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockReportService.salesSummary).toHaveBeenCalledWith(dto);
      expect(mockReportService.salesSummary).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from service', async () => {
      // Arrange
      const dto = {
        fromAt: '2024-01-31T23:59:59Z',
        toAt: '2024-01-01T00:00:00Z',
      };
      const error = new Error('fromAt must be before toAt');
      mockReportService.salesSummary.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.salesSummary(dto)).rejects.toThrow(error);
      expect(mockReportService.salesSummary).toHaveBeenCalledWith(dto);
    });
  });

  describe('productPerformance', () => {
    it('should call ReportService.productPerformance and return result', async () => {
      // Arrange
      const dto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-01-31T23:59:59Z',
      };
      const mockResponse = {
        products: [
          {
            productId: 'prod-1',
            productName: 'Product A',
            totalQuantitySold: 50,
            totalRevenueInt: 10000000,
          },
        ],
        fromAt: new Date('2024-01-01T00:00:00Z'),
        toAt: new Date('2024-01-31T23:59:59Z'),
      };
      mockReportService.productPerformance.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.productPerformance(dto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockReportService.productPerformance).toHaveBeenCalledWith(dto);
      expect(mockReportService.productPerformance).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from service', async () => {
      // Arrange
      const dto = {
        fromAt: '2024-01-31T23:59:59Z',
        toAt: '2024-01-01T00:00:00Z',
      };
      const error = new Error('fromAt must be before toAt');
      mockReportService.productPerformance.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.productPerformance(dto)).rejects.toThrow(error);
      expect(mockReportService.productPerformance).toHaveBeenCalledWith(dto);
    });
  });

  describe('userCohort', () => {
    it('should call ReportService.userCohort and return result', async () => {
      // Arrange
      const dto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-01-31T23:59:59Z',
      };
      const mockResponse = {
        newUsers: 25,
        activeUsers: 120,
        returningCustomers: 80,
        fromAt: new Date('2024-01-01T00:00:00Z'),
        toAt: new Date('2024-01-31T23:59:59Z'),
      };
      mockReportService.userCohort.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.userCohort(dto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockReportService.userCohort).toHaveBeenCalledWith(dto);
      expect(mockReportService.userCohort).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from service', async () => {
      // Arrange
      const dto = {
        fromAt: '2024-01-31T23:59:59Z',
        toAt: '2024-01-01T00:00:00Z',
      };
      const error = new Error('fromAt must be before toAt');
      mockReportService.userCohort.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.userCohort(dto)).rejects.toThrow(error);
      expect(mockReportService.userCohort).toHaveBeenCalledWith(dto);
    });
  });
});
