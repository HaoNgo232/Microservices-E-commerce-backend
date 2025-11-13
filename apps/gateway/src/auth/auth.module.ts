import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { JwtModule } from '@shared/main';
import { KeyReceiverService } from '@gateway/key-receiver.service';

/**
 * Auth Module
 * Cung cấp authentication endpoints, guards, và authorization
 * Receive JWT public key từ user-app qua NATS
 * Không cần service layer - controller gửi trực tiếp qua NATS
 */
@Module({
  imports: [JwtModule], // Import JwtModule để verify token locally
  controllers: [AuthController],
  providers: [
    AuthGuard,
    RolesGuard,
    {
      provide: 'KEY_RECEIVER_SERVICE',
      useExisting: KeyReceiverService,
    },
  ],
  exports: [AuthGuard, RolesGuard, KeyReceiverService],
})
export class AuthModule {}
