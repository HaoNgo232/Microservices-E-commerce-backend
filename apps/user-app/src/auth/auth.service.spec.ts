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
  });
});
