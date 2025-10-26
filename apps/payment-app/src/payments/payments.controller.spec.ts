import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@payment-app/prisma/prisma.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockPaymentsService: jest.Mocked<PaymentsService>;

  beforeEach(async () => {
    const mockPaymentsServiceInstance = {
      process: jest.fn(),
      verify: jest.fn(),
      getById: jest.fn(),
      getByOrder: jest.fn(),
    };

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
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsServiceInstance,
        },
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

    controller = module.get<PaymentsController>(PaymentsController);
    mockPaymentsService = module.get(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
