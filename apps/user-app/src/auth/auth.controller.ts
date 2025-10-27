import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from '@user-app/auth/auth.service';
import { EVENTS } from '@shared/events';
import { LoginDto, VerifyDto, RefreshDto, RegisterDto } from '@shared/dto/auth.dto';
import { AuthResponse } from '@shared/main';
import { JWTPayload } from 'jose';

export interface IAuthController {
  login(dto: LoginDto): Promise<AuthResponse>;
  register(dto: RegisterDto): Promise<AuthResponse>;
  verify(dto: VerifyDto): Promise<JWTPayload>;
  refresh(dto: RefreshDto): Promise<AuthResponse>;
}

@Controller()
export class AuthController implements IAuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(EVENTS.AUTH.LOGIN)
  login(@Payload() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @MessagePattern(EVENTS.AUTH.REGISTER)
  register(@Payload() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @MessagePattern(EVENTS.AUTH.VERIFY)
  verify(@Payload() dto: VerifyDto): Promise<JWTPayload> {
    return this.authService.verify(dto);
  }

  @MessagePattern(EVENTS.AUTH.REFRESH)
  refresh(@Payload() dto: RefreshDto): Promise<AuthResponse> {
    return this.authService.refresh(dto);
  }
}
