/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { of } from 'rxjs';
import { JwtService } from '@shared/main';

describe('AuthGuard + RolesGuard Integration', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jwtService: any;

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    fullName: 'Test User',
    role: 'CUSTOMER',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('USER_SERVICE')
      .useValue({
        send: jest.fn(),
      })
      .overrideProvider(JwtService)
      .useValue({
        verifyToken: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userService = moduleFixture.get('USER_SERVICE');
    jwtService = moduleFixture.get(JwtService);

    // Setup default mocks
    userService.send.mockReturnValue(of(mockUser));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthGuard rejects invalid tokens', () => {
    it('should return 401 when no token provided', async () => {
      const response = await request(app.getHttpServer()).get('/users').expect(401);

      expect(response.body.message).toContain('Missing authorization header');
      expect(userService.send).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      jwtService.verifyToken.mockRejectedValueOnce(new Error('Invalid token'));

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toContain('Invalid or expired token');
      expect(userService.send).not.toHaveBeenCalled();
    });

    it('should return 401 when token format is invalid', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.message).toContain('Invalid authorization format');
      expect(userService.send).not.toHaveBeenCalled();
    });
  });

  describe('Valid ADMIN token + ADMIN endpoint', () => {
    it('should allow ADMIN to access /users', async () => {
      const adminPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
      jwtService.verifyToken.mockResolvedValueOnce(adminPayload);

      userService.send.mockReturnValueOnce(
        of({ users: [mockUser], total: 1, page: 1, pageSize: 10 }),
      );

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer admin.token')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.total).toBe(1);
      expect(userService.send).toHaveBeenCalled();
    });

    it('should allow ADMIN to access /users/email/:email', async () => {
      const adminPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
      jwtService.verifyToken.mockResolvedValueOnce(adminPayload);

      await request(app.getHttpServer())
        .get('/users/email/user@example.com')
        .set('Authorization', 'Bearer admin.token')
        .expect(200);

      expect(userService.send).toHaveBeenCalled();
    });
  });

  describe('Valid CUSTOMER token + ADMIN endpoint', () => {
    it('should deny CUSTOMER access to /users (admin-only)', async () => {
      const customerPayload = {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer customer.token')
        .expect(403);

      expect(response.body.message).toContain('Access denied');
      expect(response.body.message).toContain('Required roles: ADMIN');
      expect(response.body.message).toContain('Your role: CUSTOMER');
      expect(userService.send).not.toHaveBeenCalled();
    });

    it('should deny CUSTOMER access to /users/email/:email (admin-only)', async () => {
      const customerPayload = {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      const response = await request(app.getHttpServer())
        .get('/users/email/test@example.com')
        .set('Authorization', 'Bearer customer.token')
        .expect(403);

      expect(response.body.statusCode).toBe(403);
      expect(userService.send).not.toHaveBeenCalled();
    });
  });

  describe('Valid token + endpoint without @Roles()', () => {
    it('should allow any authenticated user to access endpoint without @Roles()', async () => {
      const customerPayload = {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      const response = await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', 'Bearer customer.token')
        .expect(200);

      expect(response.body).toEqual(mockUser);
      expect(userService.send).toHaveBeenCalled();
    });

    it('should allow ADMIN to access endpoint without @Roles()', async () => {
      const adminPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
      jwtService.verifyToken.mockResolvedValueOnce(adminPayload);

      const response = await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', 'Bearer admin.token')
        .expect(200);

      expect(response.body).toEqual(mockUser);
      expect(userService.send).toHaveBeenCalled();
    });
  });

  describe('Valid token with multiple roles allowed', () => {
    it('should allow CUSTOMER access to endpoint requiring ADMIN or CUSTOMER', async () => {
      const customerPayload = {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', 'Bearer customer.token')
        .expect(200);

      expect(userService.send).toHaveBeenCalled();
    });

    it('should allow ADMIN access to endpoint requiring ADMIN or CUSTOMER', async () => {
      const adminPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
      jwtService.verifyToken.mockResolvedValueOnce(adminPayload);

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', 'Bearer admin.token')
        .expect(200);

      expect(userService.send).toHaveBeenCalled();
    });
  });

  describe('Error response format', () => {
    it('should return 401 with correct error structure', async () => {
      const response = await request(app.getHttpServer()).get('/users').expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
        error: 'Unauthorized',
      });
    });

    it('should return 403 with correct error structure', async () => {
      const customerPayload = {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer customer.token')
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Access denied'),
        error: 'Forbidden',
      });
    });

    it('should include detailed role information in 403 error message', async () => {
      const customerPayload = {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer customer.token')
        .expect(403);

      expect(response.body.message).toContain('Required roles');
      expect(response.body.message).toContain('Your role');
    });
  });

  describe('Guard execution order', () => {
    it('should run AuthGuard before RolesGuard', async () => {
      // This test verifies that AuthGuard runs first
      // If RolesGuard ran first, it would throw before AuthGuard could reject invalid token
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);

      // If AuthGuard didn't run first, we'd get a different error
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Token verification integration', () => {
    it('should call verifyToken with correct token', async () => {
      const customerPayload = {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', 'Bearer test.token')
        .expect(200);

      expect(jwtService.verifyToken).toHaveBeenCalledWith('test.token');
    });

    it('should reject requests with expired token', async () => {
      const expiredError = new Error('Token has expired');
      Object.assign(expiredError, { name: 'TokenExpiredError' });
      jwtService.verifyToken.mockRejectedValueOnce(expiredError);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer expired.token')
        .expect(401);

      expect(response.body.message).toContain('expired');
    });
  });
});
