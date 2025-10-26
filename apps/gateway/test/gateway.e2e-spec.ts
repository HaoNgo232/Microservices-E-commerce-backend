/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { of, throwError } from 'rxjs';
import { JwtService } from '@shared/main';

describe('Gateway (e2e)', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let productService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cartService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jwtService: any;

  const mockAccessToken = 'mock.valid.token';
  const mockUserPayload = {
    sub: 'user-123',
    email: 'test@example.com',
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
      .overrideProvider('PRODUCT_SERVICE')
      .useValue({
        send: jest.fn(),
      })
      .overrideProvider('CART_SERVICE')
      .useValue({
        send: jest.fn(),
      })
      .overrideProvider('ORDER_SERVICE')
      .useValue({
        send: jest.fn(),
      })
      .overrideProvider('PAYMENT_SERVICE')
      .useValue({
        send: jest.fn(),
      })
      .overrideProvider('AR_SERVICE')
      .useValue({
        send: jest.fn(),
      })
      .overrideProvider('REPORT_SERVICE')
      .useValue({
        send: jest.fn(),
      })
      .overrideProvider(JwtService)
      .useValue({
        verifyToken: jest.fn(),
        signToken: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userService = moduleFixture.get('USER_SERVICE');
    productService = moduleFixture.get('PRODUCT_SERVICE');
    cartService = moduleFixture.get('CART_SERVICE');
    jwtService = moduleFixture.get(JwtService);

    // Setup default JWT verification
    jwtService.verifyToken.mockResolvedValue(mockUserPayload);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/:id', () => {
    it('should return user data when service responds', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'CUSTOMER',
      };

      userService.send.mockReturnValue(of(mockUser));

      const response = await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body).toEqual(mockUser);
      expect(userService.send).toHaveBeenCalled();
      expect(jwtService.verifyToken).toHaveBeenCalledWith(mockAccessToken);
    });

    it('should return 401 when no token provided', async () => {
      await request(app.getHttpServer()).get('/users/user-123').expect(401);

      expect(userService.send).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      jwtService.verifyToken.mockRejectedValueOnce(new Error('Invalid token'));

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);

      expect(userService.send).not.toHaveBeenCalled();
    });
  });

  describe('GET /products/slug/:slug', () => {
    it('should return product data when service responds', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        slug: 'test-product',
        priceInt: 1999,
      };

      productService.send.mockReturnValue(of(mockProduct));

      const response = await request(app.getHttpServer())
        .get('/products/slug/test-product')
        .expect(200);

      expect(response.body).toEqual(mockProduct);
      expect(productService.send).toHaveBeenCalled();
    });
  });

  describe('GET /cart', () => {
    it('should return cart data when service responds', async () => {
      const mockCart = {
        id: '1',
        sessionId: 'test-session',
        items: [],
      };

      cartService.send.mockReturnValue(of(mockCart));

      const response = await request(app.getHttpServer())
        .get('/cart?sessionId=test-session')
        .expect(200);

      expect(response.body).toEqual(mockCart);
      expect(cartService.send).toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('should expose readiness information', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.status).toBe('ok');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('Authentication Flow', () => {
    it('should allow access to public endpoints without token', async () => {
      const mockProduct = {
        id: '1',
        name: 'Public Product',
        slug: 'public-product',
        priceInt: 1999,
      };

      productService.send.mockReturnValue(of(mockProduct));

      await request(app.getHttpServer()).get('/products/slug/public-product').expect(200);

      expect(productService.send).toHaveBeenCalled();
    });

    it('should deny access to protected endpoints without token', async () => {
      await request(app.getHttpServer()).get('/users/user-123').expect(401);

      expect(userService.send).not.toHaveBeenCalled();
    });

    it('should allow access to protected endpoints with valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'CUSTOMER',
      };

      userService.send.mockReturnValue(of(mockUser));

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(jwtService.verifyToken).toHaveBeenCalledWith(mockAccessToken);
      expect(userService.send).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle microservice timeout errors', async () => {
      // Mock Observable that times out
      userService.send.mockReturnValue(
        throwError(() => ({ name: 'TimeoutError', message: 'Timeout' })),
      );

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(408); // Request Timeout
    });

    it('should handle microservice errors and return appropriate status', async () => {
      const notFoundError = new Error('User not found');
      Object.assign(notFoundError, { statusCode: 404 });

      userService.send.mockReturnValue(throwError(() => notFoundError));

      await request(app.getHttpServer())
        .get('/users/non-existent')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(404);
    });
  });

  describe('Request/Response Cycle', () => {
    it('should successfully process request and return response', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        slug: 'test-product',
        priceInt: 1999,
      };

      productService.send.mockReturnValue(of(mockProduct));

      const response = await request(app.getHttpServer())
        .get('/products/slug/test-product')
        .expect(200);

      expect(response.body).toEqual(mockProduct);
      expect(productService.send).toHaveBeenCalled();
    });
  });

  describe('Authorization (Role-based Access Control)', () => {
    const mockUserList = [
      { id: 'user-1', email: 'user1@example.com', fullName: 'User One', role: 'CUSTOMER' },
      { id: 'user-2', email: 'user2@example.com', fullName: 'User Two', role: 'ADMIN' },
    ];

    beforeEach(() => {
      userService.send.mockReturnValue(
        of({ users: mockUserList, total: 2, page: 1, pageSize: 10 }),
      );
    });

    it('should allow ADMIN to access /users endpoint', async () => {
      // Mock ADMIN token
      const adminPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
      jwtService.verifyToken.mockResolvedValueOnce(adminPayload);

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer admin.token`)
        .expect(200);

      expect(userService.send).toHaveBeenCalled();
    });

    it('should deny CUSTOMER access to /users endpoint (admin-only)', async () => {
      // Mock CUSTOMER token
      const customerPayload = { sub: 'user-123', email: 'user@example.com', role: 'CUSTOMER' };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer customer.token`)
        .expect(403);

      expect(userService.send).not.toHaveBeenCalled();
    });

    it('should allow both ADMIN and CUSTOMER to access /users/:id', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        fullName: 'Test User',
        role: 'CUSTOMER',
      };

      // Test with CUSTOMER token
      const customerPayload = { sub: 'user-123', email: 'user@example.com', role: 'CUSTOMER' };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);
      userService.send.mockReturnValue(of(mockUser));

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', `Bearer customer.token`)
        .expect(200);

      // Test with ADMIN token
      const adminPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
      jwtService.verifyToken.mockResolvedValueOnce(adminPayload);

      await request(app.getHttpServer())
        .get('/users/user-123')
        .set('Authorization', `Bearer admin.token`)
        .expect(200);

      expect(userService.send).toHaveBeenCalled();
    });

    it('should deny CUSTOMER access to /users/email/:email (admin-only)', async () => {
      const customerPayload = { sub: 'user-123', email: 'user@example.com', role: 'CUSTOMER' };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      await request(app.getHttpServer())
        .get('/users/email/test@example.com')
        .set('Authorization', `Bearer customer.token`)
        .expect(403);

      expect(userService.send).not.toHaveBeenCalled();
    });

    it('should return 403 with proper error message when role mismatch', async () => {
      const customerPayload = { sub: 'user-123', email: 'user@example.com', role: 'CUSTOMER' };
      jwtService.verifyToken.mockResolvedValueOnce(customerPayload);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer customer.token`)
        .expect(403);

      expect(response.body.message).toContain('Access denied');
      expect(response.body.message).toContain('Required roles: ADMIN');
      expect(response.body.message).toContain('Your role: CUSTOMER');
    });
  });
});
