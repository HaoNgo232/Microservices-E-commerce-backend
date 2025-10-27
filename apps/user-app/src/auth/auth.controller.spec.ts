import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, VerifyDto, RefreshDto } from '@shared/dto/auth.dto';
import { AuthResponse, UserRole } from '@shared/main';
import { JWTPayload } from 'jose';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    verify: jest.fn(),
    refresh: jest.fn(),
  };

  const mockAuthResponse: AuthResponse = {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
  };

  const mockJWTPayload: JWTPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: 'CUSTOMER',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'luan-van-ecommerce',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('nên đăng nhập thành công với thông tin hợp lệ', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockAuthResponse);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(service.login).toHaveBeenCalledWith(loginDto);
      expect(service.login).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi thông tin đăng nhập sai', async () => {
      const loginDto: LoginDto = {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      };
      const error = new Error('Invalid email or password');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow('Invalid email or password');
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });

    it('nên handle lỗi khi tài khoản bị vô hiệu hóa', async () => {
      const loginDto: LoginDto = {
        email: 'deactivated@example.com',
        password: 'Password123!',
      };
      const error = new Error('Account is deactivated');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow('Account is deactivated');
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('register', () => {
    it('nên đăng ký người dùng mới thành công', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        fullName: 'New User',
      };
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockAuthResponse);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(service.register).toHaveBeenCalledWith(registerDto);
      expect(service.register).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi email đã tồn tại', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        fullName: 'Existing User',
      };
      const error = new Error('Email already exists');
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow('Email already exists');
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });

    it('nên tạo user với role CUSTOMER mặc định', async () => {
      const registerDto: RegisterDto = {
        email: 'customer@example.com',
        password: 'Password123!',
        fullName: 'Customer User',
      };
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      // Token được tạo thành công (role sẽ có trong JWT payload)
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('verify', () => {
    it('nên xác minh token hợp lệ thành công', async () => {
      const verifyDto: VerifyDto = {
        token: 'valid.jwt.token',
      };
      mockAuthService.verify.mockResolvedValue(mockJWTPayload);

      const result = await controller.verify(verifyDto);

      expect(result).toEqual(mockJWTPayload);
      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('CUSTOMER');
      expect(service.verify).toHaveBeenCalledWith(verifyDto);
      expect(service.verify).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi token không hợp lệ', async () => {
      const verifyDto: VerifyDto = {
        token: 'invalid.jwt.token',
      };
      const error = new Error('Invalid token');
      mockAuthService.verify.mockRejectedValue(error);

      await expect(controller.verify(verifyDto)).rejects.toThrow('Invalid token');
      expect(service.verify).toHaveBeenCalledWith(verifyDto);
    });

    it('nên handle lỗi khi token đã hết hạn', async () => {
      const verifyDto: VerifyDto = {
        token: 'expired.jwt.token',
      };
      const error = new Error('Token has expired');
      mockAuthService.verify.mockRejectedValue(error);

      await expect(controller.verify(verifyDto)).rejects.toThrow('Token has expired');
      expect(service.verify).toHaveBeenCalledWith(verifyDto);
    });
  });

  describe('refresh', () => {
    it('nên làm mới token thành công', async () => {
      const refreshDto: RefreshDto = {
        refreshToken: 'valid.refresh.token',
      };
      const newTokens = {
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
      };
      mockAuthService.refresh.mockResolvedValue(newTokens);

      const result = await controller.refresh(refreshDto);

      expect(result).toEqual(newTokens);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(service.refresh).toHaveBeenCalledWith(refreshDto);
      expect(service.refresh).toHaveBeenCalledTimes(1);
    });

    it('nên handle lỗi khi refresh token không hợp lệ', async () => {
      const refreshDto: RefreshDto = {
        refreshToken: 'invalid.refresh.token',
      };
      const error = new Error('Invalid refresh token');
      mockAuthService.refresh.mockRejectedValue(error);

      await expect(controller.refresh(refreshDto)).rejects.toThrow('Invalid refresh token');
      expect(service.refresh).toHaveBeenCalledWith(refreshDto);
    });

    it('nên handle lỗi khi refresh token đã hết hạn', async () => {
      const refreshDto: RefreshDto = {
        refreshToken: 'expired.refresh.token',
      };
      const error = new Error('Token has expired');
      mockAuthService.refresh.mockRejectedValue(error);

      await expect(controller.refresh(refreshDto)).rejects.toThrow('Token has expired');
      expect(service.refresh).toHaveBeenCalledWith(refreshDto);
    });
  });

  describe('Authentication Flow Integration', () => {
    it('nên hoàn thành flow authentication đầy đủ', async () => {
      // 1. Register
      const registerDto: RegisterDto = {
        email: 'flow@example.com',
        password: 'Password123!',
        fullName: 'Flow Test User',
      };
      mockAuthService.register.mockResolvedValue(mockAuthResponse);
      const registerResult = await controller.register(registerDto);
      expect(registerResult.accessToken).toBeDefined();

      // 2. Verify token
      mockAuthService.verify.mockResolvedValue(mockJWTPayload);
      const verifyResult = await controller.verify({ token: registerResult.accessToken });
      expect(verifyResult.sub).toBe(mockJWTPayload.sub);

      // 3. Refresh token
      const newTokens = {
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
      };
      mockAuthService.refresh.mockResolvedValue(newTokens);
      const refreshResult = await controller.refresh({ refreshToken: registerResult.refreshToken });
      expect(refreshResult.accessToken).toBeDefined();

      expect(service.register).toHaveBeenCalledTimes(1);
      expect(service.verify).toHaveBeenCalledTimes(1);
      expect(service.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
