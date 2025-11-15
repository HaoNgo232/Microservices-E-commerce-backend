import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@shared/main';
import { UsersModule } from '@user-app/users/users.module';
import { AuthModule } from '@user-app/auth/auth.module';
import { AddressModule } from '@user-app/address/address.module';
import { PrismaService } from '@user-app/prisma/prisma.service';

/**
 * User App Module
 * Microservice chịu trách nhiệm:
 * - User management và authentication
 * - Generate JWT key pair
 * - Publish public key qua NATS để gateway dùng verify
 */
@Module({
  imports: [
    JwtModule,
    TerminusModule,
    UsersModule,
    AuthModule,
    AddressModule,
    // Register NATS client cho key distribution
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
  controllers: [],
  providers: [PrismaService],
})
export class UserAppModule {}
