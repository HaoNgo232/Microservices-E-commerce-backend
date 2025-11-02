import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { CartAppModule } from '../src/cart-app.module';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { CartGetDto, CartAddItemDto, CartUpdateItemDto, CartRemoveItemDto } from '@shared/dto/cart.dto';
import { firstValueFrom, of } from 'rxjs';
import { expectRpcError } from '@shared/testing/rpc-test-helpers';

describe('CartController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;
  let productClient: ClientProxy;

  // Test data
  const testUserId = 'user-123';
  const testProductId = 'product-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        CartAppModule,
        ClientsModule.register([
          {
            name: 'CART_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
          {
            name: 'PRODUCT_SERVICE',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
        queue: 'cart-app-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('CART_SERVICE_CLIENT');
    productClient = moduleFixture.get('PRODUCT_SERVICE');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();
    await productClient.connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await client.close();
    await productClient.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test để đảm bảo tính độc lập
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});

    // Mock Product Service responses
    jest.spyOn(productClient, 'send').mockImplementation((pattern: string, payload: unknown) => {
      if (pattern === EVENTS.PRODUCT.GET_BY_IDS) {
        // Check if the requested product IDs match our test product
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
      return of([]);
    });
  });

  describe('CART.GET', () => {
    it('should create empty cart when getting non-existent cart', async () => {
      const dto: CartGetDto = {
        userId: testUserId,
      };

      const result = await firstValueFrom(client.send(EVENTS.CART.GET, dto));

      expect(result).toBeDefined();
      expect(result.cart).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(0);
      expect(result.cart.userId).toBe(testUserId);
    });
  });

  describe('CART.ADD_ITEM', () => {
    it('should add item to cart', async () => {
      const dto: CartAddItemDto = {
        userId: testUserId,
        productId: testProductId,
        quantity: 2,
      };

      const result = await firstValueFrom(client.send(EVENTS.CART.ADD_ITEM, dto));

      expect(result).toBeDefined();
      expect(result.cartItem).toBeDefined();
      expect(result.cartItem?.productId).toBe(testProductId);
      expect(result.cartItem?.quantity).toBe(2);
    });

    it('should update quantity when adding duplicate product', async () => {
      // Add item once
      await firstValueFrom(
        client.send(EVENTS.CART.ADD_ITEM, {
          userId: testUserId,
          productId: testProductId,
          quantity: 2,
        }),
      );

      // Add same product again
      const result = await firstValueFrom(
        client.send(EVENTS.CART.ADD_ITEM, {
          userId: testUserId,
          productId: testProductId,
          quantity: 3,
        }),
      );

      expect(result.cartItem?.quantity).toBe(5); // 2 + 3 = 5
      expect(result.cartItem?.productId).toBe(testProductId);
    });
  });

  describe('CART.UPDATE_ITEM', () => {
    it('should update item quantity', async () => {
      // First add an item
      await firstValueFrom(
        client.send(EVENTS.CART.ADD_ITEM, {
          userId: testUserId,
          productId: testProductId,
          quantity: 2,
        }),
      );

      // Then update it
      const dto: CartUpdateItemDto = {
        userId: testUserId,
        productId: testProductId,
        quantity: 5,
      };

      const result = await firstValueFrom(client.send(EVENTS.CART.UPDATE_ITEM, dto));

      expect(result).toBeDefined();
      expect(result.cartItem).toBeDefined();
      expect(result.cartItem?.quantity).toBe(5);
      expect(result.cartItem?.productId).toBe(testProductId);
    });

    it('should throw error when updating non-existent item', async () => {
      const dto: CartUpdateItemDto = {
        userId: testUserId,
        productId: 'non-existent-product-999',
        quantity: 5,
      };

      await expectRpcError(firstValueFrom(client.send(EVENTS.CART.UPDATE_ITEM, dto)), 'không tồn tại');
    });
  });

  describe('CART.REMOVE_ITEM', () => {
    it('should remove item from cart', async () => {
      // First add an item
      await firstValueFrom(
        client.send(EVENTS.CART.ADD_ITEM, {
          userId: testUserId,
          productId: testProductId,
          quantity: 2,
        }),
      );

      // Remove the item
      const dto: CartRemoveItemDto = {
        userId: testUserId,
        productId: testProductId,
      };

      const result = await firstValueFrom(client.send(EVENTS.CART.REMOVE_ITEM, dto));

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle removing non-existent item gracefully', async () => {
      const dto: CartRemoveItemDto = {
        userId: testUserId,
        productId: 'non-existent-product-999',
      };

      // Service should handle this gracefully
      const result = await firstValueFrom(client.send(EVENTS.CART.REMOVE_ITEM, dto));

      expect(result.success).toBe(true);
    });
  });
});
