import { Test, TestingModule } from '@nestjs/testing';
import { ArService } from './ar.service';
import { PrismaService } from '@ar-app/prisma/prisma.service';

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
});
