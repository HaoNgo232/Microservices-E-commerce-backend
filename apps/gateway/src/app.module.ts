import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HealthController } from '@gateway/health.controller';
import { GatewayClientsModule } from '@gateway/gateway-clients.module';
import { AuthModule } from '@gateway/auth/auth.module';
import { UsersModule } from '@gateway/users/users.module';
import { AddressesModule } from '@gateway/addresses/addresses.module';
import { ProductsModule } from '@gateway/products/products.module';
import { CartModule } from '@gateway/cart/cart.module';
import { OrdersModule } from '@gateway/orders/orders.module';
import { PaymentsModule } from '@gateway/payments/payments.module';
import { ArModule } from '@gateway/ar/ar.module';
import { JwtModule } from '@shared/main';
import { RateLimitMiddleware } from '@gateway/middleware/rate-limit.middleware';
import { AuditLogMiddleware } from '@gateway/middleware/audit-log.middleware';
import { KeyReceiverService } from '@gateway/key-receiver.service';

/**
 * App Module
 * Main module cho API Gateway
 * Implement Perimeter Security pattern với middleware stack
 * Receive public key từ user-app qua NATS
 */
@Module({
  imports: [
    JwtModule,
    TerminusModule,
    GatewayClientsModule, // Register all NATS clients globally
    AuthModule,
    UsersModule,
    AddressesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    ArModule,
    // Register NATS client cho key receiver
    ClientsModule.register([
      {
        name: 'NATS_CLIENT',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
        },
      },
    ]),
  ],
  controllers: [HealthController],
  providers: [KeyReceiverService],
})
export class AppModule implements NestModule {
  /**
   * Configure global middleware cho Perimeter Security
   * AuditLogMiddleware chạy trước để log tất cả requests
   * RateLimitMiddleware chạy sau để enforce rate limits
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditLogMiddleware, RateLimitMiddleware).forRoutes('*');
  }
}
