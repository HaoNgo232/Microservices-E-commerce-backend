import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthService } from '@user-app/auth/auth.service';
import { AuthController } from '@user-app/auth/auth.controller';
import { PrismaService } from '@user-app/prisma/prisma.service';
import { KeyDistributorService } from '@user-app/key-distributor.service';

@Module({
  imports: [
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
  controllers: [AuthController],
  providers: [AuthService, PrismaService, KeyDistributorService],
  exports: [AuthService],
})
export class AuthModule {}
