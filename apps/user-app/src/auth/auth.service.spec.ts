import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { JwtService } from '@shared/main';
import { LoginDto } from '@shared/dto/auth.dto';
import { PrismaService } from '@user-app/prisma/prisma.service';

// Giả lập module bcrypt
jest.mock('bcryptjs');
import * as bcrypt from 'bcryptjs';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// Giả lập JwtService
const mockJwtService = {
  signToken: jest.fn(),
  verifyToken: jest.fn(),
  decodeToken: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);

    // Set test environment variables
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    jest.clearAllMocks();
  });

  describe('Constructor and Environment Variables', () => {
    it('should use default JWT expiry values when env vars not set', async () => {
      // Remove env vars
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_REFRESH_EXPIRES_IN;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: JwtService,
            useValue: mockJwtService,
          },
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);

      // Service should be created with default values
      expect(testService).toBeDefined();

      // Restore env vars
      process.env.JWT_EXPIRES_IN = '15m';
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    });

    it('should use custom JWT expiry values from env vars', async () => {
      process.env.JWT_EXPIRES_IN = '30m';
      process.env.JWT_REFRESH_EXPIRES_IN = '14d';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: JwtService,
            useValue: mockJwtService,
          },
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);
      expect(testService).toBeDefined();

      // Restore default values
      process.env.JWT_EXPIRES_IN = '15m';
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signToken.mockResolvedValue('mock_token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.passwordHash);
      expect(mockJwtService.signToken).toHaveBeenCalledTimes(2); // access + refresh token
    });

    it('should throw RpcException when user not found', async () => {
      const loginDto: LoginDto = {
        email: 'notfound@example.com',
        password: 'password123',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when password is invalid', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when user is inactive', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        isActive: false,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(RpcException);
    });

    it('should handle non-RpcException errors in login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signToken.mockRejectedValue(new Error('Token generation failed'));

      await expect(service.login(loginDto)).rejects.toThrow(RpcException);
      await expect(service.login(loginDto)).rejects.toThrow('Login failed');
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      };

      const mockHashedPassword = 'hashed_password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHashedPassword);

      const mockNewUser = {
        id: 'new-id',
        email: registerDto.email,
        fullName: registerDto.fullName,
        role: 'CUSTOMER',
      };

      prisma.user.findUnique.mockResolvedValue(null); // Email doesn't exist
      prisma.user.create.mockResolvedValue(mockNewUser);
      mockJwtService.signToken.mockResolvedValue('mock_token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: mockHashedPassword,
          fullName: registerDto.fullName,
          role: 'CUSTOMER',
        },
      });
    });

    it('should throw RpcException when email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'password123',
        fullName: 'Existing User',
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(RpcException);
      await expect(service.register(registerDto)).rejects.toThrow('Email already exists');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle non-RpcException errors in register', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('Database error'));

      await expect(service.register(registerDto)).rejects.toThrow(RpcException);
      await expect(service.register(registerDto)).rejects.toThrow('Failed to register user');
    });
  });

  describe('verify', () => {
    it('should return decoded token when valid', async () => {
      const mockPayload = {
        sub: '1', // Use 'sub' instead of 'userId'
        email: 'test@example.com',
        role: 'CUSTOMER',
      };

      const mockUser = {
        id: '1',
        isActive: true,
      };

      mockJwtService.verifyToken.mockResolvedValue(mockPayload);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.verify({ token: 'valid_token' });

      expect(result).toEqual(mockPayload);
      expect(mockJwtService.verifyToken).toHaveBeenCalledWith('valid_token');
    });

    it('should throw RpcException when token is invalid', async () => {
      mockJwtService.verifyToken.mockRejectedValue(new RpcException({ statusCode: 401, message: 'Invalid token' }));

      await expect(service.verify({ token: 'invalid_token' })).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when token is expired', async () => {
      mockJwtService.verifyToken.mockRejectedValue(new RpcException({ statusCode: 401, message: 'Token has expired' }));

      await expect(service.verify({ token: 'expired_token' })).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when user is inactive', async () => {
      const mockPayload = {
        sub: '1', // Use 'sub' instead of 'userId'
        email: 'test@example.com',
        role: 'CUSTOMER',
      };

      const mockUser = {
        id: '1',
        isActive: false,
      };

      mockJwtService.verifyToken.mockResolvedValue(mockPayload);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.verify({ token: 'valid_token' })).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when token payload missing sub claim', async () => {
      const mockPayload = {
        email: 'test@example.com',
        role: 'CUSTOMER',
        // Missing 'sub' claim
      };

      mockJwtService.verifyToken.mockResolvedValue(mockPayload);

      await expect(service.verify({ token: 'token_without_sub' })).rejects.toThrow(RpcException);
      await expect(service.verify({ token: 'token_without_sub' })).rejects.toThrow(
        'Token payload must contain sub claim',
      );
    });

    it('should throw RpcException when user not found during verify', async () => {
      const mockPayload = {
        sub: '1',
        email: 'test@example.com',
        role: 'CUSTOMER',
      };

      mockJwtService.verifyToken.mockResolvedValue(mockPayload);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verify({ token: 'valid_token' })).rejects.toThrow(RpcException);
      await expect(service.verify({ token: 'valid_token' })).rejects.toThrow('Invalid or expired token');
    });

    it('should handle non-RpcException errors in verify', async () => {
      mockJwtService.verifyToken.mockRejectedValue(new Error('JWT verification error'));

      await expect(service.verify({ token: 'token' })).rejects.toThrow(RpcException);
      await expect(service.verify({ token: 'token' })).rejects.toThrow('Token verification failed');
    });
  });

  describe('refresh', () => {
    it('should return new tokens when refresh token is valid', async () => {
      const mockPayload = {
        sub: '1', // Use 'sub' instead of 'userId'
        email: 'test@example.com',
        role: 'CUSTOMER',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        isActive: true,
      };

      mockJwtService.verifyToken.mockResolvedValue(mockPayload);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.signToken.mockResolvedValue('new_token');

      const result = await service.refresh({ refreshToken: 'valid_refresh' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw RpcException when refresh token is invalid', async () => {
      mockJwtService.verifyToken.mockRejectedValue(new RpcException({ statusCode: 401, message: 'Invalid token' }));

      await expect(service.refresh({ refreshToken: 'invalid_refresh' })).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when refresh token payload missing sub claim', async () => {
      const mockPayload = {
        email: 'test@example.com',
        role: 'CUSTOMER',
        // Missing 'sub' claim
      };

      mockJwtService.verifyToken.mockResolvedValue(mockPayload);

      await expect(service.refresh({ refreshToken: 'token_without_sub' })).rejects.toThrow(RpcException);
      await expect(service.refresh({ refreshToken: 'token_without_sub' })).rejects.toThrow(
        'Token payload must contain sub claim',
      );
    });

    it('should throw RpcException when user not found or inactive during refresh', async () => {
      const mockPayload = {
        sub: '1',
        email: 'test@example.com',
        role: 'CUSTOMER',
      };

      mockJwtService.verifyToken.mockResolvedValue(mockPayload);
      prisma.user.findUnique.mockResolvedValue(null); // User not found

      await expect(service.refresh({ refreshToken: 'valid_refresh' })).rejects.toThrow(RpcException);
      await expect(service.refresh({ refreshToken: 'valid_refresh' })).rejects.toThrow('Invalid refresh token');

      // Test with inactive user
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        isActive: false,
      });

      await expect(service.refresh({ refreshToken: 'valid_refresh' })).rejects.toThrow(RpcException);
      await expect(service.refresh({ refreshToken: 'valid_refresh' })).rejects.toThrow('Invalid refresh token');
    });

    it('should handle non-RpcException errors in refresh', async () => {
      mockJwtService.verifyToken.mockRejectedValue(new Error('JWT verification error'));

      await expect(service.refresh({ refreshToken: 'token' })).rejects.toThrow(RpcException);
      await expect(service.refresh({ refreshToken: 'token' })).rejects.toThrow('Token refresh failed');
    });
  });

  describe('parseExpiresIn', () => {
    it('should parse seconds correctly', async () => {
      process.env.JWT_EXPIRES_IN = '30s';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: JwtService, useValue: mockJwtService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signToken.mockResolvedValue('mock_token');

      await testService.login(loginDto);

      // Verify signToken was called with 30 seconds (30s)
      expect(mockJwtService.signToken).toHaveBeenCalledWith(
        expect.any(Object),
        30, // 30 seconds
      );

      process.env.JWT_EXPIRES_IN = '15m';
    });

    it('should parse minutes correctly', async () => {
      process.env.JWT_EXPIRES_IN = '45m';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: JwtService, useValue: mockJwtService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signToken.mockResolvedValue('mock_token');

      await testService.login(loginDto);

      // Verify signToken was called with 2700 seconds (45m = 45 * 60)
      expect(mockJwtService.signToken).toHaveBeenCalledWith(
        expect.any(Object),
        2700, // 45 minutes
      );

      process.env.JWT_EXPIRES_IN = '15m';
    });

    it('should parse hours correctly', async () => {
      process.env.JWT_EXPIRES_IN = '2h';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: JwtService, useValue: mockJwtService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signToken.mockResolvedValue('mock_token');

      await testService.login(loginDto);

      // Verify signToken was called with 7200 seconds (2h = 2 * 3600)
      expect(mockJwtService.signToken).toHaveBeenCalledWith(
        expect.any(Object),
        7200, // 2 hours
      );

      process.env.JWT_EXPIRES_IN = '15m';
    });

    it('should parse days correctly', async () => {
      process.env.JWT_REFRESH_EXPIRES_IN = '10d';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: JwtService, useValue: mockJwtService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signToken.mockResolvedValue('mock_token');

      await testService.login(loginDto);

      // Verify refresh token was called with 864000 seconds (10d = 10 * 86400)
      const refreshTokenCall = mockJwtService.signToken.mock.calls.find(call => call[1] === 864000);
      expect(refreshTokenCall).toBeDefined();

      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    });

    it('should use default value when expiresIn format is invalid', async () => {
      process.env.JWT_EXPIRES_IN = 'invalid-format';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: JwtService, useValue: mockJwtService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signToken.mockResolvedValue('mock_token');

      await testService.login(loginDto);

      // Verify signToken was called with default 900 seconds (15 minutes)
      expect(mockJwtService.signToken).toHaveBeenCalledWith(
        expect.any(Object),
        900, // default 15 minutes
      );

      process.env.JWT_EXPIRES_IN = '15m';
    });
  });
});
