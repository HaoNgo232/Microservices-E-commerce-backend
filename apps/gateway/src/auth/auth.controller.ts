import { Controller, Post, Body, Get, UseGuards, Req, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { LoginDto, RefreshDto, RegisterDto } from '@shared/dto/auth.dto';
import { AuthGuard } from '@gateway/auth/auth.guard';
import { BaseGatewayController } from '@gateway/base.controller';
import { EVENTS } from '@shared/events';
import { AuthResponse, VerifyResponse } from '@shared/types/auth.types';
import { UserResponse } from '@shared/types/user.types';

/**
 * Authentication Controller
 * Gateway endpoint cho authentication - forward requests đến user-service
 *
 * Pattern: API Gateway - centralized entry point với authentication
 */
@Controller('auth')
export class AuthController extends BaseGatewayController {
  constructor(@Inject('USER_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * POST /auth/register
   * Đăng ký tài khoản mới - trả về tokens
   * Client decode accessToken để lấy user info
   */
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.send<RegisterDto, AuthResponse>(EVENTS.AUTH.REGISTER, dto);
  }

  /**
   * POST /auth/login
   * Xác thực user và trả về JWT tokens
   * Client decode accessToken để lấy user info (sub, email, role)
   */
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.send<LoginDto, AuthResponse>(EVENTS.AUTH.LOGIN, dto);
  }

  /**
   * POST /auth/refresh
   * Làm mới access token bằng refresh token
   */
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<AuthResponse> {
    return this.send<RefreshDto, AuthResponse>(EVENTS.AUTH.REFRESH, dto);
  }

  /**
   * GET /auth/me
   * Lấy thông tin user hiện tại (protected route)
   * AuthGuard xác thực token cục bộ - không cần gọi qua NATS
   */
  @Get('me')
  @UseGuards(AuthGuard)
  getCurrentUser(
    @Req() req: Request & { user: { userId: string; email: string; role: string } },
  ): Promise<UserResponse> {
    return this.send<string, UserResponse>(EVENTS.USER.FIND_BY_ID, req.user.userId);
  }

  /**
   * POST /auth/verify
   * Verify JWT token validity
   */
  @Post('verify')
  verify(@Body() dto: { token: string }): Promise<VerifyResponse> {
    return this.send<{ token: string }, VerifyResponse>(EVENTS.AUTH.VERIFY, dto);
  }
}
