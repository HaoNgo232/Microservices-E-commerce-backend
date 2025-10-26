import { Test, TestingModule } from '@nestjs/testing';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';
import { PrismaService } from '@ar-app/prisma/prisma.service';

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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
