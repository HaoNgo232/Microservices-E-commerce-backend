import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { ReportAppModule } from '../src/report-app.module';
import { PrismaService } from '@report-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { SalesSummaryDto, ProductPerformanceDto, UserCohortDto } from '@shared/dto/report.dto';
import { firstValueFrom, of } from 'rxjs';
import { ProductPerformanceResponse, SalesSummaryResponse, UserCohortResponse } from '@shared/types';
import { expectRpcError } from '@shared/testing/rpc-test-helpers';

describe('ReportController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;
  let orderClient: ClientProxy;
  let userClient: ClientProxy;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ReportAppModule,
        ClientsModule.register([
          {
            name: 'REPORT_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
          {
            name: 'ORDER_SERVICE',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
          {
            name: 'USER_SERVICE',
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
        queue: 'report-app-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('REPORT_SERVICE_CLIENT');
    orderClient = moduleFixture.get('ORDER_SERVICE');
    userClient = moduleFixture.get('USER_SERVICE');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();
    await orderClient.connect();
    await userClient.connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.reportEntry.deleteMany({});
    await client.close();
    await orderClient.close();
    await userClient.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test
    await prisma.reportEntry.deleteMany({});

    // Mock Order and User services (not used in current implementation but good to have)
    jest.spyOn(orderClient, 'send').mockImplementation(() => of([]));
    jest.spyOn(userClient, 'send').mockImplementation(() => of([]));
  });

  describe('REPORT.SALES_SUMMARY', () => {
    it('should generate sales summary report', async () => {
      const dto: SalesSummaryDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-12-31T23:59:59Z',
      };

      const result = await firstValueFrom(client.send(EVENTS.REPORT.SALES_SUMMARY, dto));

      expect(result).toBeDefined();
      expect(result.totalOrders).toBeGreaterThan(0);
      expect(result.totalRevenueInt).toBeGreaterThan(0);
      expect(result.averageOrderValueInt).toBeGreaterThan(0);
      expect(result.fromAt).toBeDefined();
      expect(result.toAt).toBeDefined();
    });

    it('should throw error when fromAt > toAt', async () => {
      const dto: SalesSummaryDto = {
        fromAt: '2024-12-31T00:00:00Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      await expectRpcError(firstValueFrom(client.send(EVENTS.REPORT.SALES_SUMMARY, dto)), 'fromAt must be before toAt');
    });

    it('should handle date range correctly', async () => {
      const dto: SalesSummaryDto = {
        fromAt: '2024-06-01T00:00:00Z',
        toAt: '2024-06-30T23:59:59Z',
      };

      const result = await firstValueFrom(client.send<SalesSummaryResponse>(EVENTS.REPORT.SALES_SUMMARY, dto));

      expect(result).toBeDefined();
      expect(new Date(result.fromAt).getTime()).toBeLessThan(new Date(result.toAt).getTime());
    });
  });

  describe('REPORT.PRODUCT_PERF', () => {
    it('should generate product performance report', async () => {
      const dto: ProductPerformanceDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-12-31T23:59:59Z',
      };

      const result = await firstValueFrom(client.send<ProductPerformanceResponse>(EVENTS.REPORT.PRODUCT_PERF, dto));

      expect(result).toBeDefined();
      expect(result.products).toBeDefined();
      expect(result.products.length).toBeGreaterThan(0);
      expect(result.products[0]).toHaveProperty('productId');
      expect(result.products[0]).toHaveProperty('productName');
      expect(result.products[0]).toHaveProperty('totalQuantitySold');
      expect(result.products[0]).toHaveProperty('totalRevenueInt');
      expect(result.fromAt).toBeDefined();
      expect(result.toAt).toBeDefined();
    });

    it('should throw error when fromAt > toAt', async () => {
      const dto: ProductPerformanceDto = {
        fromAt: '2024-12-31T00:00:00Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      await expectRpcError(firstValueFrom(client.send(EVENTS.REPORT.PRODUCT_PERF, dto)), 'fromAt must be before toAt');
    });

    it('should return product data with correct structure', async () => {
      const dto: ProductPerformanceDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-03-31T23:59:59Z',
      };

      const result = await firstValueFrom(client.send(EVENTS.REPORT.PRODUCT_PERF, dto));

      expect(result.products).toBeDefined();
      for (const product of result.products) {
        expect(typeof product.productId).toBe('string');
        expect(typeof product.productName).toBe('string');
        expect(typeof product.totalQuantitySold).toBe('number');
        expect(typeof product.totalRevenueInt).toBe('number');
      }
    });
  });

  describe('REPORT.USER_COHORT', () => {
    it('should generate user cohort report', async () => {
      const dto: UserCohortDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-12-31T23:59:59Z',
      };

      const result = await firstValueFrom(client.send<UserCohortResponse>(EVENTS.REPORT.USER_COHORT, dto));

      expect(result).toBeDefined();
      expect(result.newUsers).toBeGreaterThanOrEqual(0);
      expect(result.activeUsers).toBeGreaterThanOrEqual(0);
      expect(result.returningCustomers).toBeGreaterThanOrEqual(0);
      expect(result.fromAt).toBeDefined();
      expect(result.toAt).toBeDefined();
    });

    it('should throw error when fromAt > toAt', async () => {
      const dto: UserCohortDto = {
        fromAt: '2024-12-31T00:00:00Z',
        toAt: '2024-01-01T00:00:00Z',
      };

      await expectRpcError(firstValueFrom(client.send(EVENTS.REPORT.USER_COHORT, dto)), 'fromAt must be before toAt');
    });

    it('should return user metrics correctly', async () => {
      const dto: UserCohortDto = {
        fromAt: '2024-01-01T00:00:00Z',
        toAt: '2024-06-30T23:59:59Z',
      };

      const result = await firstValueFrom(client.send(EVENTS.REPORT.USER_COHORT, dto));

      expect(result).toBeDefined();
      expect(typeof result.newUsers).toBe('number');
      expect(typeof result.activeUsers).toBe('number');
      expect(typeof result.returningCustomers).toBe('number');
      expect(result.newUsers).toBeGreaterThanOrEqual(0);
      expect(result.activeUsers).toBeGreaterThanOrEqual(0);
      expect(result.returningCustomers).toBeGreaterThanOrEqual(0);
    });
  });
});
