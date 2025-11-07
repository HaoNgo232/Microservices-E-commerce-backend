/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck, MicroserviceHealthIndicator, HealthCheckResult } from '@nestjs/terminus';
import { Transport, ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * HealthController - Kiểm tra sức khỏe hệ thống
 *
 * Cung cấp các endpoint để monitoring và health checking:
 * - GET /health - Kiểm tra kết nối NATS
 * - GET /health/ready - Readiness probe cho Kubernetes
 * - GET /health/live - Liveness probe cho Kubernetes
 * - GET /health/services - Chi tiết sức khỏe từng microservice
 *
 * **Mục đích:**
 * - Monitoring hệ thống distributed
 * - Kubernetes health checks
 * - Service discovery và load balancing
 */
@Controller('health')
export class HealthController {
  /**
   * Constructor: Inject các service phụ thuộc
   * - HealthCheckService: Check sức khỏe hệ thống
   * - MicroserviceHealthIndicator: Kiểm tra kết nối NATS
   * - NATS Clients: Gửi health check message đến microservices
   */
  constructor(
    private readonly health: HealthCheckService,
    private readonly microservice: MicroserviceHealthIndicator,
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
    @Inject('PRODUCT_SERVICE') private readonly productService: ClientProxy,
    @Inject('ORDER_SERVICE') private readonly orderService: ClientProxy,
    @Inject('AR_SERVICE') private readonly arService: ClientProxy,
    @Inject('PAYMENT_SERVICE') private readonly paymentService: ClientProxy,
    @Inject('CART_SERVICE') private readonly cartService: ClientProxy,
    @Inject('REPORT_SERVICE') private readonly reportService: ClientProxy,
  ) {}

  /**
   * Health Check - Kiểm tra kết nối NATS
   *
   * Endpoint: GET /health
   * - Dùng cho Kubernetes liveness probe
   * - Ping NATS server qua MicroserviceHealthIndicator
   * - Timeout: 3000ms
   * - Trả về HealthCheckResult từ NestJS Terminus
   */
  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () =>
        this.microservice.pingCheck('nats', {
          transport: Transport.NATS,
          options: {
            servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
          },
          timeout: 3000,
        }),
    ]);
  }

  /**
   * Readiness Probe - Kiểm tra sẵn sàng của Gateway
   *
   * Endpoint: GET /health/ready
   * - Kubernetes dùng để xác định pod sẵn sàng nhận traffic
   * - Trả về timestamp hiện tại + uptime của process
   * - Luôn trả về 200 OK nếu gateway chạy bình thường
   */
  @Get('ready')
  readiness(): {
    status: string;
    timestamp: string;
    uptime: number;
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Liveness Probe - Kiểm tra trạng thái sống của Gateway
   *
   * Endpoint: GET /health/live
   * - Kubernetes dùng để xác định pod còn sống
   * - Nếu endpoint không response, Kubernetes sẽ restart pod
   * - Trả về timestamp hiện tại
   */
  @Get('live')
  liveness(): {
    status: string;
    timestamp: string;
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Services Health Check - Kiểm tra chi tiết sức khỏe từng microservice
   *
   * Endpoint: GET /health/services
   * - Gửi health_check message đến user-service, product-service, order-service
   * - Timeout: 2000ms cho mỗi service
   * - Đo latency (thời gian response)
   * - Trả về status và latency của từng service
   *
   * Response: { status, services: { 'service-name': { status, latency } } }
   */
  @Get('services')
  async checkServices(): Promise<{
    status: string;
    services: Record<string, { status: string; latency?: number }>;
  }> {
    // Kiểm tra tất cả service cùng lúc (parallel)
    const [userHealth, productHealth, orderHealth, arHealth, paymentHealth, cartHealth, reportHealth] =
      await Promise.all([
        this.checkService(this.userService),
        this.checkService(this.productService),
        this.checkService(this.orderService),
        this.checkService(this.arService),
        this.checkService(this.paymentService),
        this.checkService(this.cartService),
        this.checkService(this.reportService),
      ]);

    return {
      status: 'ok',
      services: {
        'user-service': userHealth,
        'product-service': productHealth,
        'order-service': orderHealth,
        'ar-service': arHealth,
        'payment-service': paymentHealth,
        'cart-service': cartHealth,
        'report-service': reportHealth,
      },
    };
  }

  /**
   * Helper: Kiểm tra sức khỏe của một microservice
   *
   * @param client - NATS ClientProxy (user-service, product-service, ...)
   * @returns { status: 'up'|'down', latency?: number }
   *
   * Flow:
   * 1. Ghi lại thời gian bắt đầu
   * 2. Gửi health_check message qua NATS (timeout 2000ms)
   * 3. Nếu thành công: trả về status='up' + latency
   * 4. Nếu timeout/lỗi: trả về status='down'
   */
  private async checkService(client: ClientProxy): Promise<{ status: string; latency?: number }> {
    const startTime = Date.now();

    try {
      await firstValueFrom(
        client.send({ cmd: 'health_check' }, {}).pipe(
          timeout(2000),
          catchError(() => of({ status: 'down' })),
        ),
      );

      return {
        status: 'up',
        latency: Date.now() - startTime,
      };
    } catch {
      return {
        status: 'down',
      };
    }
  }
}
