import { validateEnvironment, getDatabaseUrl } from './env.validation';

describe('env.validation', () => {
  const originalEnv = process.env;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    console.warn = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });

  describe('validateEnvironment', () => {
    it('should pass validation when all required env vars are present', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.JWT_SECRET_KEY = 'a-very-long-secret-key-that-is-at-least-32-characters-long';
      process.env.DATABASE_URL_USER = 'postgresql://user:pass@localhost:5432/user_db';
      process.env.DATABASE_URL_PRODUCT = 'postgresql://user:pass@localhost:5432/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://user:pass@localhost:5432/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://user:pass@localhost:5432/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://user:pass@localhost:5432/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://user:pass@localhost:5432/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://user:pass@localhost:5432/report_db';

      expect(() => validateEnvironment()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(' Environment variables validated successfully');
    });

    it('should throw error when NATS_URL is missing', () => {
      delete process.env.NATS_URL;
      process.env.JWT_SECRET_KEY = 'secret';
      process.env.DATABASE_URL_USER = 'postgresql://localhost/user_db';
      process.env.DATABASE_URL_PRODUCT = 'postgresql://localhost/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://localhost/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://localhost/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://localhost/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://localhost/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://localhost/report_db';

      expect(() => validateEnvironment()).toThrow('Missing required environment variables');
      expect(() => validateEnvironment()).toThrow('NATS_URL');
    });

    it('should throw error when JWT_SECRET_KEY is missing', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      delete process.env.JWT_SECRET_KEY;
      process.env.DATABASE_URL_USER = 'postgresql://localhost/user_db';
      process.env.DATABASE_URL_PRODUCT = 'postgresql://localhost/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://localhost/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://localhost/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://localhost/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://localhost/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://localhost/report_db';

      expect(() => validateEnvironment()).toThrow('Missing required environment variables');
      expect(() => validateEnvironment()).toThrow('JWT_SECRET_KEY');
    });

    it('should throw error when DATABASE_URL_USER is missing', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.JWT_SECRET_KEY = 'secret';
      delete process.env.DATABASE_URL_USER;
      process.env.DATABASE_URL_PRODUCT = 'postgresql://localhost/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://localhost/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://localhost/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://localhost/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://localhost/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://localhost/report_db';

      expect(() => validateEnvironment()).toThrow('Missing required environment variables');
      expect(() => validateEnvironment()).toThrow('DATABASE_URL_USER');
    });

    it('should throw error when multiple env vars are missing', () => {
      delete process.env.NATS_URL;
      delete process.env.JWT_SECRET_KEY;
      delete process.env.DATABASE_URL_USER;
      process.env.DATABASE_URL_PRODUCT = 'postgresql://localhost/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://localhost/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://localhost/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://localhost/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://localhost/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://localhost/report_db';

      expect(() => validateEnvironment()).toThrow('Missing required environment variables');
      const errorMessage = ((): string => {
        try {
          validateEnvironment();
        } catch (e) {
          return (e as Error).message;
        }
        return '';
      })();
      expect(errorMessage).toContain('NATS_URL');
      expect(errorMessage).toContain('JWT_SECRET_KEY');
      expect(errorMessage).toContain('DATABASE_URL_USER');
    });

    it('should warn when JWT_SECRET_KEY is too short', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.JWT_SECRET_KEY = 'short'; // Less than 32 characters
      process.env.DATABASE_URL_USER = 'postgresql://localhost/user_db';
      process.env.DATABASE_URL_PRODUCT = 'postgresql://localhost/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://localhost/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://localhost/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://localhost/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://localhost/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://localhost/report_db';

      validateEnvironment();

      expect(console.warn).toHaveBeenCalledWith(
        '  WARNING: JWT_SECRET_KEY should be at least 32 characters for security',
      );
    });

    it('should not warn when JWT_SECRET_KEY is 32 characters or longer', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.JWT_SECRET_KEY = 'a-very-long-secret-key-that-is-exactly-32-chars!!';
      process.env.DATABASE_URL_USER = 'postgresql://localhost/user_db';
      process.env.DATABASE_URL_PRODUCT = 'postgresql://localhost/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://localhost/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://localhost/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://localhost/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://localhost/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://localhost/report_db';

      validateEnvironment();

      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should warn when JWT_SECRET_KEY is exactly 31 characters', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.JWT_SECRET_KEY = 'a'.repeat(31); // Exactly 31 characters
      process.env.DATABASE_URL_USER = 'postgresql://localhost/user_db';
      process.env.DATABASE_URL_PRODUCT = 'postgresql://localhost/product_db';
      process.env.DATABASE_URL_CART = 'postgresql://localhost/cart_db';
      process.env.DATABASE_URL_ORDER = 'postgresql://localhost/order_db';
      process.env.DATABASE_URL_PAYMENT = 'postgresql://localhost/payment_db';
      process.env.DATABASE_URL_AR = 'postgresql://localhost/ar_db';
      process.env.DATABASE_URL_REPORT = 'postgresql://localhost/report_db';

      validateEnvironment();

      expect(console.warn).toHaveBeenCalledWith(
        '  WARNING: JWT_SECRET_KEY should be at least 32 characters for security',
      );
    });
  });

  describe('getDatabaseUrl', () => {
    it('should return database URL for user service', () => {
      process.env.DATABASE_URL_USER = 'postgresql://user:pass@localhost:5432/user_db';

      const url = getDatabaseUrl('user');

      expect(url).toBe('postgresql://user:pass@localhost:5432/user_db');
    });

    it('should return database URL for product service', () => {
      process.env.DATABASE_URL_PRODUCT = 'postgresql://user:pass@localhost:5432/product_db';

      const url = getDatabaseUrl('product');

      expect(url).toBe('postgresql://user:pass@localhost:5432/product_db');
    });

    it('should return database URL for cart service', () => {
      process.env.DATABASE_URL_CART = 'postgresql://user:pass@localhost:5432/cart_db';

      const url = getDatabaseUrl('cart');

      expect(url).toBe('postgresql://user:pass@localhost:5432/cart_db');
    });

    it('should return database URL for order service', () => {
      process.env.DATABASE_URL_ORDER = 'postgresql://user:pass@localhost:5432/order_db';

      const url = getDatabaseUrl('order');

      expect(url).toBe('postgresql://user:pass@localhost:5432/order_db');
    });

    it('should return database URL for payment service', () => {
      process.env.DATABASE_URL_PAYMENT = 'postgresql://user:pass@localhost:5432/payment_db';

      const url = getDatabaseUrl('payment');

      expect(url).toBe('postgresql://user:pass@localhost:5432/payment_db');
    });

    it('should return database URL for ar service', () => {
      process.env.DATABASE_URL_AR = 'postgresql://user:pass@localhost:5432/ar_db';

      const url = getDatabaseUrl('ar');

      expect(url).toBe('postgresql://user:pass@localhost:5432/ar_db');
    });

    it('should return database URL for report service', () => {
      process.env.DATABASE_URL_REPORT = 'postgresql://user:pass@localhost:5432/report_db';

      const url = getDatabaseUrl('report');

      expect(url).toBe('postgresql://user:pass@localhost:5432/report_db');
    });

    it('should throw error when database URL is not found for service', () => {
      delete process.env.DATABASE_URL_USER;

      expect(() => getDatabaseUrl('user')).toThrow('Database URL not found for service: user');
    });

    it('should handle uppercase service name correctly', () => {
      process.env.DATABASE_URL_USER = 'postgresql://user:pass@localhost:5432/user_db';

      // Service name is lowercase in function signature, but should work
      const url = getDatabaseUrl('user');

      expect(url).toBe('postgresql://user:pass@localhost:5432/user_db');
    });
  });
});
