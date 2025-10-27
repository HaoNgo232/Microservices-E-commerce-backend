import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { ArAppModule } from '../src/ar-app.module';
import { PrismaService } from '@ar-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { ARSnapshotCreateDto, ARSnapshotListDto } from '@shared/dto/ar.dto';
import { firstValueFrom } from 'rxjs';

describe('ArController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;

  // Test data
  const testUserId = 'user-123';
  const testProductId = 'product-123';
  const testImageUrl = 'https://example.com/ar-snapshot.jpg';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ArAppModule,
        ClientsModule.register([
          {
            name: 'AR_SERVICE_CLIENT',
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
        queue: 'ar-app-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('AR_SERVICE_CLIENT');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.aRSnapshot.deleteMany({});
    await client.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test
    await prisma.aRSnapshot.deleteMany({});
  });

  describe('AR.SNAPSHOT_CREATE', () => {
    it('should create AR snapshot with userId', async () => {
      const dto: ARSnapshotCreateDto = {
        userId: testUserId,
        productId: testProductId,
        imageUrl: testImageUrl,
        metadata: { rotation: 45, position: 'center' },
      };

      const result = await firstValueFrom(client.send(EVENTS.AR.SNAPSHOT_CREATE, dto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.imageUrl).toBe(testImageUrl);
      expect(result.createdAt).toBeDefined();
    });

    it('should create AR snapshot without userId (anonymous)', async () => {
      const dto: ARSnapshotCreateDto = {
        productId: testProductId,
        imageUrl: testImageUrl,
        metadata: { angle: 90 },
      };

      const result = await firstValueFrom(client.send(EVENTS.AR.SNAPSHOT_CREATE, dto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.imageUrl).toBe(testImageUrl);
    });

    it('should create AR snapshot without metadata', async () => {
      const dto: ARSnapshotCreateDto = {
        userId: testUserId,
        productId: testProductId,
        imageUrl: testImageUrl,
      };

      const result = await firstValueFrom(client.send(EVENTS.AR.SNAPSHOT_CREATE, dto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe('AR.SNAPSHOT_LIST', () => {
    it('should list all AR snapshots', async () => {
      // Create multiple snapshots
      await firstValueFrom(
        client.send(EVENTS.AR.SNAPSHOT_CREATE, {
          userId: testUserId,
          productId: testProductId,
          imageUrl: 'https://example.com/snapshot1.jpg',
        }),
      );

      await firstValueFrom(
        client.send(EVENTS.AR.SNAPSHOT_CREATE, {
          userId: testUserId,
          productId: 'product-456',
          imageUrl: 'https://example.com/snapshot2.jpg',
        }),
      );

      const dto: ARSnapshotListDto = {
        page: 1,
        pageSize: 20,
      };

      const result = await firstValueFrom(client.send(EVENTS.AR.SNAPSHOT_LIST, dto));

      expect(result).toBeDefined();
      expect(result.snapshots).toBeDefined();
      expect(result.snapshots.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should filter AR snapshots by userId', async () => {
      // Create snapshots for different users
      await firstValueFrom(
        client.send(EVENTS.AR.SNAPSHOT_CREATE, {
          userId: testUserId,
          productId: testProductId,
          imageUrl: 'https://example.com/snapshot1.jpg',
        }),
      );

      await firstValueFrom(
        client.send(EVENTS.AR.SNAPSHOT_CREATE, {
          userId: 'user-456',
          productId: testProductId,
          imageUrl: 'https://example.com/snapshot2.jpg',
        }),
      );

      const dto: ARSnapshotListDto = {
        userId: testUserId,
        page: 1,
        pageSize: 20,
      };

      const result = await firstValueFrom(client.send(EVENTS.AR.SNAPSHOT_LIST, dto));

      expect(result).toBeDefined();
      expect(result.snapshots).toBeDefined();
      expect(result.snapshots.length).toBeGreaterThanOrEqual(1);
      // Verify all snapshots belong to the user
      for (const snapshot of result.snapshots) {
        if (snapshot.userId !== null) {
          expect(snapshot.userId).toBe(testUserId);
        }
      }
    });

    it('should filter AR snapshots by productId', async () => {
      // Create snapshots for different products
      await firstValueFrom(
        client.send(EVENTS.AR.SNAPSHOT_CREATE, {
          userId: testUserId,
          productId: testProductId,
          imageUrl: 'https://example.com/snapshot1.jpg',
        }),
      );

      await firstValueFrom(
        client.send(EVENTS.AR.SNAPSHOT_CREATE, {
          userId: testUserId,
          productId: 'product-456',
          imageUrl: 'https://example.com/snapshot2.jpg',
        }),
      );

      const dto: ARSnapshotListDto = {
        productId: testProductId,
        page: 1,
        pageSize: 20,
      };

      const result = await firstValueFrom(client.send(EVENTS.AR.SNAPSHOT_LIST, dto));

      expect(result).toBeDefined();
      expect(result.snapshots).toBeDefined();
      expect(result.snapshots.length).toBeGreaterThanOrEqual(1);
      // Verify all snapshots belong to the product
      for (const snapshot of result.snapshots) {
        expect(snapshot.productId).toBe(testProductId);
      }
    });

    it('should support pagination', async () => {
      // Create multiple snapshots
      for (let i = 1; i <= 5; i++) {
        await firstValueFrom(
          client.send(EVENTS.AR.SNAPSHOT_CREATE, {
            userId: testUserId,
            productId: testProductId,
            imageUrl: `https://example.com/snapshot${i}.jpg`,
          }),
        );
      }

      const dto: ARSnapshotListDto = {
        page: 1,
        pageSize: 2,
      };

      const result = await firstValueFrom(client.send(EVENTS.AR.SNAPSHOT_LIST, dto));

      expect(result).toBeDefined();
      expect(result.pageSize).toBe(2);
      expect(result.snapshots.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(5);
    });
  });
});
