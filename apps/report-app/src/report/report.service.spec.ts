import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { PrismaService } from '@report-app/prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';

describe('ReportService', () => {
  let service: ReportService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockOrderClient: jest.Mocked<ClientProxy>;
  let mockUserClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mockPrisma).toBeDefined();
    expect(mockOrderClient).toBeDefined();
    expect(mockUserClient).toBeDefined();
  });
});
