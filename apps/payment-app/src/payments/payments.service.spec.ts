import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@payment-app/prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockOrderClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const mockPrismaService = {
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockClientProxy = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'ORDER_SERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    mockPrisma = module.get(PrismaService);
    mockOrderClient = module.get('ORDER_SERVICE');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
