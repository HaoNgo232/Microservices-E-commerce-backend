import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { OrderAppModule } from '../src/order-app.module';
import { PrismaService } from '@order-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { OrderCreateDto, OrderIdDto, OrderListDto, OrderUpdateStatusDto, OrderCancelDto } from '@shared/dto/order.dto';
import { firstValueFrom, of } from 'rxjs';
import { expectRpcError } from '@shared/testing/rpc-test-helpers';
import { OrderStatus } from '@shared/types';

describe('OrdersController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;

  // Test data
  const testUserId = 'user-123';
  const testProductId = 'product-123';

  // Giả lập các client
  const mockProductClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };
  const mockCartClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        OrderAppModule,
        ClientsModule.register([
          {
            name: 'ORDER_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
        ]),
      ],
    })
      .overrideProvider('PRODUCT_SERVICE')
      .useValue(mockProductClient)
      .overrideProvider('CART_SERVICE')
      .useValue(mockCartClient)
      .compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
        queue: 'order-app-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('ORDER_SERVICE_CLIENT');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();

    // Setup mocks on injected clients
    mockProductClient.send.mockImplementation((pattern: string, payload: unknown) => {
      if (pattern === EVENTS.PRODUCT.GET_BY_IDS) {
        const requestPayload = payload as { ids: string[] };
        if (requestPayload.ids.includes(testProductId) || requestPayload.ids.includes('product-456')) {
          return of(
            [
              {
                id: testProductId,
                name: 'Test Product',
                priceInt: 10000,
                imageUrls: ['https://example.com/image.jpg'],
                stock: 100,
              },
              {
                id: 'product-456',
                name: 'Another Product',
                priceInt: 20000,
                imageUrls: ['https://example.com/image2.jpg'],
                stock: 50,
              },
            ].filter(p => requestPayload.ids.includes(p.id)),
          );
        }
        return of([]);
      }
      // Giả lập DEC_STOCK cho hoạt động không chờ phản hồi
      if (pattern === EVENTS.PRODUCT.DEC_STOCK) {
        return of({ success: true });
      }
      return of([]);
    });

    // Giả lập Cart Service (clearUserCart là hoạt động không chờ phản hồi)
    mockCartClient.send.mockImplementation(() => of({ success: true }));
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await client.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
  });

  describe('ORDER.CREATE', () => {
    it('should create order with items', async () => {
      const dto: OrderCreateDto = {
        userId: testUserId,
        addressId: 'address-123',
        items: [
          {
            productId: testProductId,
            quantity: 2,
            priceInt: 10000,
          },
        ],
      };

      const result = await firstValueFrom(client.send(EVENTS.ORDER.CREATE, dto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.status).toBe('PENDING');
      expect(result.items.length).toBe(1);
      expect(result.items[0].productId).toBe(testProductId);
      expect(result.items[0].quantity).toBe(2);
      expect(result.totalInt).toBe(20000); // 2 * 10000
    });

    it('should create order with multiple items', async () => {
      const dto: OrderCreateDto = {
        userId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 3,
            priceInt: 10000,
          },
          {
            productId: 'product-456',
            quantity: 1,
            priceInt: 20000,
          },
        ],
      };

      const result = await firstValueFrom(client.send(EVENTS.ORDER.CREATE, dto));

      expect(result).toBeDefined();
      expect(result.items.length).toBe(2);
      expect(result.totalInt).toBe(50000); // 3 * 10000 + 1 * 20000
    });

    it('should throw error when creating order with empty items', async () => {
      const dto: OrderCreateDto = {
        userId: testUserId,
        items: [],
      };

      await expectRpcError(firstValueFrom(client.send(EVENTS.ORDER.CREATE, dto)), 'must contain at least one item');
    });
  });

  describe('ORDER.GET', () => {
    it('should get order by ID', async () => {
      // First create an order
      const createDto: OrderCreateDto = {
        userId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 2,
            priceInt: 10000,
          },
        ],
      };
      const createdOrder = await firstValueFrom(client.send(EVENTS.ORDER.CREATE, createDto));

      // Then get it
      const dto: OrderIdDto = {
        id: createdOrder.id,
      };

      const result = await firstValueFrom(client.send(EVENTS.ORDER.GET, dto));

      expect(result).toBeDefined();
      expect(result.id).toBe(createdOrder.id);
      expect(result.userId).toBe(testUserId);
      expect(result.items.length).toBe(1);
    });

    it('should throw error when getting non-existent order', async () => {
      const dto: OrderIdDto = {
        id: 'non-existent-order',
      };

      await expectRpcError(firstValueFrom(client.send(EVENTS.ORDER.GET, dto)), 'không tồn tại');
    });
  });

  describe('ORDER.LIST_BY_USER', () => {
    it('should list orders for user', async () => {
      // Create a few orders
      await firstValueFrom(
        client.send(EVENTS.ORDER.CREATE, {
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1, priceInt: 10000 }],
        }),
      );
      await firstValueFrom(
        client.send(EVENTS.ORDER.CREATE, {
          userId: testUserId,
          items: [{ productId: 'product-456', quantity: 2, priceInt: 20000 }],
        }),
      );

      const dto: OrderListDto = {
        userId: testUserId,
        page: 1,
        pageSize: 10,
      };

      const result = await firstValueFrom(client.send(EVENTS.ORDER.LIST, dto));

      expect(result).toBeDefined();
      expect(result.orders).toBeDefined();
      expect(result.orders.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should support pagination', async () => {
      // Create at least 2 orders for pagination test
      await firstValueFrom(
        client.send(EVENTS.ORDER.CREATE, {
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1, priceInt: 10000 }],
        }),
      );
      await firstValueFrom(
        client.send(EVENTS.ORDER.CREATE, {
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1, priceInt: 10000 }],
        }),
      );

      const dto: OrderListDto = {
        userId: testUserId,
        page: 1,
        pageSize: 1,
      };

      const result = await firstValueFrom(client.send(EVENTS.ORDER.LIST, dto));

      expect(result.pageSize).toBe(1);
      expect(result.orders.length).toBe(1);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ORDER.UPDATE_STATUS', () => {
    it('should update order status', async () => {
      // Create an order
      const createResult = await firstValueFrom(
        client.send(EVENTS.ORDER.CREATE, {
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1, priceInt: 10000 }],
        }),
      );

      // PENDING -> PROCESSING
      let updateDto: OrderUpdateStatusDto = {
        id: createResult.id,
        status: OrderStatus.PROCESSING,
      };
      let result = await firstValueFrom(client.send(EVENTS.ORDER.UPDATE_STATUS, updateDto));
      expect(result.status).toBe(OrderStatus.PROCESSING);

      // PROCESSING -> SHIPPED
      updateDto = {
        id: createResult.id,
        status: OrderStatus.SHIPPED,
      };
      result = await firstValueFrom(client.send(EVENTS.ORDER.UPDATE_STATUS, updateDto));
      expect(result.status).toBe(OrderStatus.SHIPPED);

      // SHIPPED -> DELIVERED
      updateDto = {
        id: createResult.id,
        status: OrderStatus.DELIVERED,
      };
      result = await firstValueFrom(client.send(EVENTS.ORDER.UPDATE_STATUS, updateDto));

      expect(result).toBeDefined();
      expect(result.id).toBe(createResult.id);
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('should throw error when updating non-existent order', async () => {
      const dto: OrderUpdateStatusDto = {
        id: 'non-existent-order',
        status: OrderStatus.PROCESSING,
      };

      await expectRpcError(firstValueFrom(client.send(EVENTS.ORDER.UPDATE_STATUS, dto)), 'không tồn tại');
    });
  });

  describe('ORDER.CANCEL', () => {
    it('should cancel pending order', async () => {
      const createResult = await firstValueFrom(
        client.send(EVENTS.ORDER.CREATE, {
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1, priceInt: 10000 }],
        }),
      );

      const dto: OrderCancelDto = {
        id: createResult.id,
        reason: 'Test cancellation',
      };

      const result = await firstValueFrom(client.send(EVENTS.ORDER.CANCEL, dto));

      expect(result).toBeDefined();
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error when canceling already cancelled order', async () => {
      const createResult = await firstValueFrom(
        client.send(EVENTS.ORDER.CREATE, {
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1, priceInt: 10000 }],
        }),
      );

      // First cancel
      await firstValueFrom(client.send(EVENTS.ORDER.CANCEL, { id: createResult.id }));

      // Try to cancel again
      await expectRpcError(
        firstValueFrom(client.send(EVENTS.ORDER.CANCEL, { id: createResult.id })),
        'already cancelled',
      );
    });
  });
});
