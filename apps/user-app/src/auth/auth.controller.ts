import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from '@user-app/auth/auth.service';
import { KeyDistributorService } from '@user-app/auth/key-distributor.service';
import { EVENTS } from '@shared/events';
import { LoginDto, VerifyDto, RefreshDto, RegisterDto } from '@shared/dto/auth.dto';
import { JWTPayload } from 'jose';
import { AuthResponse } from '@shared/types';

/**
 * Interface cho Auth Controller
 * Định nghĩa các phương thức authentication
 */
export interface IAuthController {
  /**
   * Đăng nhập với email và password
   */
  login(dto: LoginDto): Promise<AuthResponse>;

  /**
   * Đăng ký tài khoản mới
   */
  register(dto: RegisterDto): Promise<AuthResponse>;

  /**
   * Xác thực JWT token
   */
  verify(dto: VerifyDto): Promise<JWTPayload>;

  /**
   * Làm mới access token bằng refresh token
   */
  refresh(dto: RefreshDto): Promise<AuthResponse>;
}

/**
 * AuthController - NATS Message Handler cho Authentication
 *
 * Xử lý các NATS messages liên quan đến authentication:
 * - LOGIN: Xác thực email/password và trả về JWT tokens
 * - REGISTER: Đăng ký user mới và trả về JWT tokens
 * - VERIFY: Xác thực JWT token (check signature và expiry)
 * - REFRESH: Làm mới access token bằng refresh token
 *
 * **Bảo mật:**
 * - JWT tokens được sign bằng RSA private key
 * - Password được hash bằng bcrypt (salt rounds = 10)
 * - Token payload chứa: sub (userId), email, role
 *
 * **Lưu ý:** Controller chỉ route messages; business logic nằm trong `AuthService`
 */
@Controller()
export class AuthController implements IAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly keyDistributor: KeyDistributorService,
  ) {}

  /**
   * NATS Handler: Đăng nhập
   *
   * Pattern: auth.login
   * @param dto - { email, password }
   * @returns JWT tokens (accessToken, refreshToken)
   */
  @MessagePattern(EVENTS.AUTH.LOGIN)
  login(@Payload() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * NATS Handler: Đăng ký tài khoản mới
   *
   * Pattern: auth.register
   * @param dto - { email, password, fullName }
   * @returns JWT tokens (accessToken, refreshToken)
   */
  @MessagePattern(EVENTS.AUTH.REGISTER)
  register(@Payload() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /**
   * NATS Handler: Xác thực JWT token
   *
   * Pattern: auth.verify
   * @param dto - { token }
   * @returns JWT payload nếu token hợp lệ
   */
  @MessagePattern(EVENTS.AUTH.VERIFY)
  verify(@Payload() dto: VerifyDto): Promise<JWTPayload> {
    return this.authService.verify(dto);
  }

  /**
   * NATS Handler: Làm mới access token
   *
   * Pattern: auth.refresh
   * @param dto - { refreshToken }
   * @returns JWT tokens mới (accessToken, refreshToken)
   */
  @MessagePattern(EVENTS.AUTH.REFRESH)
  refresh(@Payload() dto: RefreshDto): Promise<AuthResponse> {
    return this.authService.refresh(dto);
  }

  /**
   * NATS Handler: Respond to Gateway public key request
   *
   * Pattern: auth.public-key
   * Gateway send() request để lấy public key, user-app reply với key
   * @returns { publicKey, algorithm, issuedAt }
   */
  @MessagePattern('auth.public-key')
  getPublicKey(): { publicKey: string; algorithm: string; issuedAt: string } {
    return this.keyDistributor.handlePublicKeyRequest();
  }
}
