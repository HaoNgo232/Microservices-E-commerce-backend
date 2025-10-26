import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { JwtModule } from '@shared/main';

/**
 * Auth Module
 * Cung cấp authentication endpoints, guards, và authorization
 * Không cần service layer - controller gửi trực tiếp qua NATS
 */
@Module({
  imports: [JwtModule], // Import JwtModule để verify token locally
  controllers: [AuthController],
  providers: [AuthGuard, RolesGuard],
  exports: [AuthGuard, RolesGuard],
})
export class AuthModule {}
