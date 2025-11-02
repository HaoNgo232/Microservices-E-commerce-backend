import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { ProductAppModule } from '../src/product-app.module';
import { EVENTS } from '@shared/events';
import { ProductCreateDto, ProductUpdateDto } from '@shared/dto/product.dto';
import { firstValueFrom } from 'rxjs';

describe('ProductsController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ProductAppModule,
        ClientsModule.register([
          {
            name: 'PRODUCT_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
            },
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
        queue: 'product-app-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('PRODUCT_SERVICE_CLIENT');
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  describe('Product CRUD Operations', () => {
    let createdProductId: string;
    let productSlug: string;

    it('should create a new product', async () => {
      const timestamp = Date.now();
      const createDto: ProductCreateDto = {
        sku: `TEST-SKU-${timestamp}`,
        name: `Test Product ${timestamp}`,
        slug: `test-product-${timestamp}`,
        priceInt: 9999,
        stock: 100,
        description: 'This is a test product',
        imageUrls: ['https://example.com/image1.jpg'],
        attributes: { color: 'red', size: 'M' },
      };

      const result = await firstValueFrom(client.send(EVENTS.PRODUCT.CREATE, createDto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.sku).toBe(createDto.sku);
      expect(result.name).toBe(createDto.name);
      expect(result.priceInt).toBe(createDto.priceInt);

      createdProductId = result.id;
      productSlug = result.slug;
    });

    it('should find product by ID', async () => {
      const result = await firstValueFrom(client.send(EVENTS.PRODUCT.GET_BY_ID, { id: createdProductId }));

      expect(result).toBeDefined();
      expect(result.id).toBe(createdProductId);
    });

    it('should find product by slug', async () => {
      const result = await firstValueFrom(client.send(EVENTS.PRODUCT.GET_BY_SLUG, { slug: productSlug }));

      expect(result).toBeDefined();
      expect(result.slug).toBe(productSlug);
    });

    it('should list products with pagination', async () => {
      const result = await firstValueFrom(client.send(EVENTS.PRODUCT.LIST, { page: 1, pageSize: 10 }));

      expect(result).toBeDefined();
      expect(result.products).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should update product', async () => {
      const updateDto: ProductUpdateDto = {
        name: 'Updated Product Name',
        stock: 150,
        priceInt: 12999,
      };

      const result = await firstValueFrom(client.send(EVENTS.PRODUCT.UPDATE, { id: createdProductId, dto: updateDto }));

      expect(result).toBeDefined();
      expect(result.name).toBe(updateDto.name);
      expect(result.priceInt).toBe(updateDto.priceInt);
    });

    it('should delete product', async () => {
      const result = await firstValueFrom(client.send(EVENTS.PRODUCT.DELETE, createdProductId));

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});
