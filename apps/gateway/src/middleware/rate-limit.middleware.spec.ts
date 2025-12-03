import { RateLimitMiddleware } from './rate-limit.middleware';
import { Request, Response, NextFunction } from 'express';
import { HttpException } from '@nestjs/common';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new RateLimitMiddleware();
    mockRequest = {
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should allow requests within limit', () => {
    // Act - Make 50 requests
    for (let i = 0; i < 50; i++) {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    }

    // Assert
    expect(mockNext).toHaveBeenCalledTimes(50);
  });

  it('should block requests exceeding limit', () => {
    // Act - Make 101 requests (exceeds limit of 100)
    for (let i = 0; i < 100; i++) {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    }

    // 101st request should throw
    expect(() => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    }).toThrow(HttpException);

    expect(() => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    }).toThrow('Too many requests, please try again later');
  });

  it('should reset counter after time window', () => {
    // Arrange - Make 100 requests
    for (let i = 0; i < 100; i++) {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    }

    // Act - Wait for window to expire (61 seconds)
    jest.useFakeTimers();
    jest.advanceTimersByTime(61000);

    // Should allow request after window reset
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalledTimes(101);

    jest.useRealTimers();
  });

  it('should use IP address as client key', () => {
    // Arrange
    const requestWithIp = {
      ip: '192.168.1.1',
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };

    // Act
    middleware.use(requestWithIp as Request, mockResponse as Response, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use socket remoteAddress if IP not available', () => {
    // Arrange
    const requestWithoutIp = {
      socket: {
        remoteAddress: '192.168.1.2',
      },
    };

    // Act
    middleware.use(requestWithoutIp as Request, mockResponse as Response, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use unknown if neither IP nor remoteAddress available', () => {
    // Arrange
    const requestWithoutBoth = {
      socket: {},
    };

    // Act
    middleware.use(requestWithoutBoth as Request, mockResponse as Response, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalled();
  });

  it('should track different IPs separately', () => {
    // Arrange
    const request1 = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };
    const request2 = { ip: '192.168.1.1', socket: { remoteAddress: '192.168.1.1' } };

    // Act - Make 100 requests from IP1
    for (let i = 0; i < 100; i++) {
      middleware.use(request1 as Request, mockResponse as Response, mockNext);
    }

    // IP2 should still be able to make requests
    middleware.use(request2 as Request, mockResponse as Response, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalledTimes(101);
  });
});
