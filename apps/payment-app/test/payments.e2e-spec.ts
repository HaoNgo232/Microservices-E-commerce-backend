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
import { PaymentMethod } from '@shared/types/payment.types';
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

    // Get instances from the test module
    client = moduleFixture.get('PAYMENT_SERVICE_CLIENT');
    prisma = app.get<PrismaService>(PrismaService);

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
    it('should process COD payment (status UNPAID initially)', async () => {
      const dto: PaymentProcessDto = {
        orderId: testOrderId,
        method: PaymentMethod.COD,
        amountInt: 50000,
      };

      const result = await firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto));

      expect(result).toBeDefined();
      expect(result.paymentId).toBeDefined();
      expect(result.status).toBe('UNPAID'); // COD starts as UNPAID
      expect(result.message).toContain('will be completed on delivery');
    });

    it('should process SePay payment', async () => {
      const dto: PaymentProcessDto = {
        orderId: testOrderId,
        method: PaymentMethod.SEPAY,
        amountInt: 50000,
      };

      const result = await firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto));

      expect(result).toBeDefined();
      expect(result.paymentId).toBeDefined();
      expect(result.status).toBe('UNPAID');
      expect(result.paymentUrl).toBeDefined();
      expect(result.message).toContain('SePay payment created');
    });

    it('should throw error when processing payment for non-existent order', async () => {
      const dto: PaymentProcessDto = {
        orderId: 'non-existent-order',
        method: PaymentMethod.COD,
        amountInt: 50000,
      };

      await expectRpcError(
        firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto)),
        'Failed to validate order',
      );
    });
  });

  describe('PAYMENT.CONFIRM_COD', () => {
    it('should confirm COD payment by orderId', async () => {
      // First create a COD payment (UNPAID)
      const processResult = await firstValueFrom(
        client.send(EVENTS.PAYMENT.PROCESS, {
          orderId: testOrderId,
          method: PaymentMethod.COD,
          amountInt: 50000,
        }),
      );

      expect(processResult.status).toBe('UNPAID');

      // Confirm COD payment
      const confirmResult = await firstValueFrom(
        client.send(EVENTS.PAYMENT.CONFIRM_COD, {
          orderId: testOrderId,
        }),
      );

      expect(confirmResult).toBeDefined();
      expect(confirmResult.status).toBe('PAID');
      expect(confirmResult.method).toBe('COD');
    });

    it('should throw error when confirming non-COD payment', async () => {
      // Create SePay payment
      await firstValueFrom(
        client.send(EVENTS.PAYMENT.PROCESS, {
          orderId: testOrderId,
          method: PaymentMethod.SEPAY,
          amountInt: 50000,
        }),
      );

      // Try to confirm as COD
      await expectRpcError(
        firstValueFrom(
          client.send(EVENTS.PAYMENT.CONFIRM_COD, {
            orderId: testOrderId,
          }),
        ),
        'Cannot confirm non-COD payment',
      );
    });

    it('should throw error when confirming already PAID payment', async () => {
      // Create and confirm COD payment
      await firstValueFrom(
        client.send(EVENTS.PAYMENT.PROCESS, {
          orderId: testOrderId,
          method: PaymentMethod.COD,
          amountInt: 50000,
        }),
      );

      await firstValueFrom(
        client.send(EVENTS.PAYMENT.CONFIRM_COD, {
          orderId: testOrderId,
        }),
      );

      // Try to confirm again
      await expectRpcError(
        firstValueFrom(
          client.send(EVENTS.PAYMENT.CONFIRM_COD, {
            orderId: testOrderId,
          }),
        ),
        'Payment already confirmed',
      );
    });
  });

  describe('PAYMENT.VERIFY', () => {
    it('should verify payment from gateway', async () => {
      // First create a payment
      await firstValueFrom(
        client.send(EVENTS.PAYMENT.PROCESS, {
          orderId: testOrderId,
          method: PaymentMethod.SEPAY,
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
      expect(result.status).toBe('PAID');
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
          method: PaymentMethod.COD,
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
