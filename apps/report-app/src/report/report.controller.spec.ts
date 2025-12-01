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
});
