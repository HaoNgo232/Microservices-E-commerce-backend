import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { PaymentAppModule } from '../src/payment-app.module';
import { PrismaService } from '@payment-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import {
  PaymentProcessDto,
  PaymentVerifyDto,
  PaymentIdDto,
  PaymentByOrderDto,
} from '@shared/dto/payment.dto';
import { firstValueFrom, of } from 'rxjs';
import { expectRpcError } from '@shared/testing/rpc-test-helpers';

describe('PaymentsController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;

  // Test data
  const testOrderId = 'order-123';

  // Mock Order Service client
  const mockOrderClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PaymentAppModule,
        ClientsModule.register([
          {
            name: 'PAYMENT_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
        ]),
      ],
    })
      .overrideProvider('ORDER_SERVICE')
      .useValue(mockOrderClient)
      .compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
        queue: 'payment-app-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('PAYMENT_SERVICE_CLIENT');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();

    // Setup mocks
    mockOrderClient.send.mockImplementation((pattern: string, payload: unknown) => {
      if (pattern === EVENTS.ORDER.GET) {
        const requestPayload = payload as { id: string };
        if (requestPayload.id === testOrderId) {
          return of({
            id: testOrderId,
            userId: 'user-123',
            status: 'PENDING',
            totalInt: 50000,
            items: [{ productId: 'product-123', quantity: 2, priceInt: 25000 }],
          });
        }
        throw new Error('Order not found');
      }
      if (pattern === EVENTS.ORDER.UPDATE_STATUS) {
        return of({
          id: (payload as { id: string }).id,
          status: 'PAID',
        });
      }
      return of(null);
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.payment.deleteMany({});
    await client.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test
    await prisma.payment.deleteMany({});
  });

  describe('PAYMENT.PROCESS', () => {
    it('should process COD payment', async () => {
      const dto: PaymentProcessDto = {
        orderId: testOrderId,
        method: 'COD',
        amountInt: 50000,
      };

      const result = await firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto));

      expect(result).toBeDefined();
      expect(result.paymentId).toBeDefined();
      expect(result.status).toBe('SUCCESS');
      expect(result.message).toContain('COD payment processed');
    });

    it('should process SePay payment', async () => {
      const dto: PaymentProcessDto = {
        orderId: testOrderId,
        method: 'SEPAY',
        amountInt: 50000,
      };

      const result = await firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto));

      expect(result).toBeDefined();
      expect(result.paymentId).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.paymentUrl).toBeDefined();
      expect(result.message).toContain('Redirect to payment gateway');
    });

    it('should throw error when processing payment for non-existent order', async () => {
      const dto: PaymentProcessDto = {
        orderId: 'non-existent-order',
        method: 'COD',
        amountInt: 50000,
      };

      await expectRpcError(
        firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto)),
        'Failed to validate order',
      );
    });
  });

  describe('PAYMENT.VERIFY', () => {
    it('should verify payment from gateway', async () => {
      // First create a payment
      await firstValueFrom(
        client.send(EVENTS.PAYMENT.PROCESS, {
          orderId: testOrderId,
          method: 'SePay',
          amountInt: 50000,
        }),
      );

      const dto: PaymentVerifyDto = {
        orderId: testOrderId,
        payload: {
          transactionId: 'tx-123',
          status: 'success',
        },
      };

      const result = await firstValueFrom(client.send(EVENTS.PAYMENT.VERIFY, dto));

      expect(result).toBeDefined();
      expect(result.verified).toBe(true);
      expect(result.status).toBe('SUCCESS');
    });

    it('should throw error when verifying non-existent payment', async () => {
      const dto: PaymentVerifyDto = {
        orderId: 'non-existent-order',
        payload: {},
      };

      await expectRpcError(
        firstValueFrom(client.send(EVENTS.PAYMENT.VERIFY, dto)),
        'không tồn tại',
      );
    });
  });

  describe('PAYMENT.GET_BY_ID', () => {
    it('should get payment by ID', async () => {
      // First create a payment
      const processResult = await firstValueFrom(
        client.send(EVENTS.PAYMENT.PROCESS, {
          orderId: testOrderId,
          method: 'COD',
          amountInt: 50000,
        }),
      );

      const dto: PaymentIdDto = {
        id: processResult.paymentId,
      };

      const result = await firstValueFrom(client.send(EVENTS.PAYMENT.GET_BY_ID, dto));

      expect(result).toBeDefined();
      expect(result.id).toBe(processResult.paymentId);
    });

    it('should throw error when getting non-existent payment', async () => {
      const dto: PaymentIdDto = {
        id: 'non-existent-payment',
      };

      await expectRpcError(
        firstValueFrom(client.send(EVENTS.PAYMENT.GET_BY_ID, dto)),
        'không tồn tại',
      );
    });
  });

  describe('PAYMENT.GET_BY_ORDER', () => {
    it('should get payment by order ID', async () => {
      // First create a payment
      await firstValueFrom(
        client.send(EVENTS.PAYMENT.PROCESS, {
          orderId: testOrderId,
          method: 'COD',
          amountInt: 50000,
        }),
      );

      const dto: PaymentByOrderDto = {
        orderId: testOrderId,
      };

      const result = await firstValueFrom(client.send(EVENTS.PAYMENT.GET_BY_ORDER, dto));

      expect(result).toBeDefined();
      expect(result.orderId).toBe(testOrderId);
    });

    it('should throw error when getting non-existent payment for order', async () => {
      const dto: PaymentByOrderDto = {
        orderId: 'non-existent-order',
      };

      await expectRpcError(
        firstValueFrom(client.send(EVENTS.PAYMENT.GET_BY_ORDER, dto)),
        'không tồn tại',
      );
    });
  });
});
