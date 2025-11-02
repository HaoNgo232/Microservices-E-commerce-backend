import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { ProductAppModule } from '../src/product-app.module';
import { EVENTS } from '@shared/events';
import { CategoryCreateDto, CategoryUpdateDto } from '@shared/dto/category.dto';
import { firstValueFrom } from 'rxjs';

describe('CategoriesController (e2e)', () => {
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
        queue: 'category-test',
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

  describe('Category CRUD Operations', () => {
    let createdCategoryId: string;
    let categorySlug: string;

    it('should create a new category', async () => {
      const timestamp = Date.now();
      const createDto: CategoryCreateDto = {
        name: `Test Category ${timestamp}`,
        slug: `test-category-${timestamp}`,
        description: 'This is a test category',
      };

      const result = await firstValueFrom(client.send(EVENTS.CATEGORY.CREATE, createDto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(createDto.name);
      expect(result.slug).toBe(createDto.slug);

      createdCategoryId = result.id;
      categorySlug = result.slug;
    });

    it('should find category by ID', async () => {
      const result = await firstValueFrom(client.send(EVENTS.CATEGORY.GET_BY_ID, { id: createdCategoryId }));

      expect(result).toBeDefined();
      expect(result.id).toBe(createdCategoryId);
    });

    it('should find category by slug', async () => {
      const result = await firstValueFrom(client.send(EVENTS.CATEGORY.GET_BY_SLUG, { slug: categorySlug }));

      expect(result).toBeDefined();
      expect(result.slug).toBe(categorySlug);
    });

    it('should list categories', async () => {
      const result = await firstValueFrom(client.send(EVENTS.CATEGORY.LIST, { page: 1, pageSize: 10 }));

      expect(result).toBeDefined();
      expect(result.categories).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should update category', async () => {
      const updateDto: CategoryUpdateDto = {
        name: 'Updated Category Name',
        description: 'Updated description',
      };

      const result = await firstValueFrom(
        client.send(EVENTS.CATEGORY.UPDATE, { id: createdCategoryId, dto: updateDto }),
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it('should delete category', async () => {
      const result = await firstValueFrom(client.send(EVENTS.CATEGORY.DELETE, createdCategoryId));

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});
