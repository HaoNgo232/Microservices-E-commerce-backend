import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { UserAppModule } from '../src/user-app.module';
import { PrismaService } from '@user-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { LoginDto, RefreshDto, RegisterDto } from '@shared/dto/auth.dto';
import { firstValueFrom } from 'rxjs';

describe('AuthController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;
  let testUserEmail: string;
  let testUserPassword: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        UserAppModule,
        ClientsModule.register([
          {
            name: 'USER_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
        queue: 'auth-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('USER_SERVICE_CLIENT');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({});
    await client.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test
    await prisma.user.deleteMany({});

    // Tạo test user cho các test cần authentication
    testUserEmail = `auth-test-${Date.now()}@example.com`;
    testUserPassword = 'Test@123456';
  });

  describe('Authentication Flow', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        email: `register-${Date.now()}@example.com`,
        password: 'Register@123',
        fullName: 'New Register User',
      };

      const result = await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // User info có trong JWT payload, không trả về riêng
      expect(result.user).toBeUndefined();
    });

    it('should fail registration with duplicate email', async () => {
      const registerDto: RegisterDto = {
        email: 'duplicate-register@example.com',
        password: 'Register@123',
        fullName: 'Duplicate User',
      };

      // Đăng ký lần đầu
      await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));

      // Thử đăng ký lại với email trùng
      try {
        await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));
        fail('Should have thrown an error');
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'message' in error) {
          expect((error as Record<string, unknown>).message).toContain('Email already exists');
        }
      }
    });

    it('should login successfully', async () => {
      // Tạo user trước khi login
      const registerDto: RegisterDto = {
        email: testUserEmail,
        password: testUserPassword,
        fullName: 'Login Test User',
      };
      await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));

      const loginDto: LoginDto = {
        email: testUserEmail,
        password: testUserPassword,
      };

      const result = await firstValueFrom(client.send(EVENTS.AUTH.LOGIN, loginDto));

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // User info có trong JWT payload, không trả về riêng
      expect(result.user).toBeUndefined();
    });

    it('should fail login with wrong password', async () => {
      // Tạo user trước
      const registerDto: RegisterDto = {
        email: 'wrongpass@example.com',
        password: 'CorrectPass@123',
        fullName: 'Wrong Pass Test',
      };
      await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));

      const loginDto: LoginDto = {
        email: 'wrongpass@example.com',
        password: 'WrongPassword123',
      };

      try {
        await firstValueFrom(client.send(EVENTS.AUTH.LOGIN, loginDto));
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid email or password');
      }
    });

    it('should fail login with non-existent email', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'AnyPassword123',
      };

      try {
        await firstValueFrom(client.send(EVENTS.AUTH.LOGIN, loginDto));
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid email or password');
      }
    });

    it('should verify valid token', async () => {
      // Tạo user mới và login để có token fresh
      const registerDto: RegisterDto = {
        email: `verify-test-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Verify Test User',
      };
      await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));

      const loginDto: LoginDto = {
        email: registerDto.email,
        password: registerDto.password,
      };
      const loginResult = await firstValueFrom(client.send(EVENTS.AUTH.LOGIN, loginDto));
      const tokenToVerify = loginResult.accessToken;

      const result = await firstValueFrom(
        client.send(EVENTS.AUTH.VERIFY, { token: tokenToVerify }),
      );

      expect(result).toBeDefined();
      expect(result.sub).toBeDefined();
      expect(result.email).toBe(registerDto.email);
    });

    it('should refresh token', async () => {
      // Tạo user mới và login để có refresh token fresh
      const registerDto: RegisterDto = {
        email: `refresh-test-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Refresh Test User',
      };
      await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));

      const loginDto: LoginDto = {
        email: registerDto.email,
        password: registerDto.password,
      };
      const loginResult = await firstValueFrom(client.send(EVENTS.AUTH.LOGIN, loginDto));
      const tokenToRefresh = loginResult.refreshToken;

      const refreshDto: RefreshDto = {
        refreshToken: tokenToRefresh,
      };

      const result = await firstValueFrom(client.send(EVENTS.AUTH.REFRESH, refreshDto));

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });
});
