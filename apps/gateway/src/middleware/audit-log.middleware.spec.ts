import { AuditLogMiddleware } from './audit-log.middleware';
import { Request, Response, NextFunction } from 'express';

describe('AuditLogMiddleware', () => {
  let middleware: AuditLogMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new AuditLogMiddleware();
    mockRequest = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      user: { userId: 'user-123' },
    };
    mockResponse = {
      statusCode: 200,
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          setTimeout(callback, 0);
        }
      }),
    };
    mockNext = jest.fn();

    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should log request details after response finishes', done => {
    // Act
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));

    // Wait for finish event
    setTimeout(() => {
      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as jest.Mock).mock.calls[0][0] as string;
      const logData = JSON.parse(logCall);
      expect(logData.method).toBe('GET');
      expect(logData.path).toBe('/api/test');
      expect(logData.statusCode).toBe(200);
      expect(logData.ip).toBe('127.0.0.1');
      expect(logData.userId).toBe('user-123');
      expect(logData.duration).toMatch(/\d+ms/);
      done();
    }, 10);
  });

  it('should log request without user if not authenticated', done => {
    // Arrange
    mockRequest.user = undefined;

    // Act
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Wait for finish event
    setTimeout(() => {
      const logCall = (console.log as jest.Mock).mock.calls[0][0] as string;
      const logData = JSON.parse(logCall);
      expect(logData.userId).toBeUndefined();
      done();
    }, 10);
  });

  it('should calculate duration correctly', done => {
    // Arrange
    const startTime = Date.now();

    // Act
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Wait for finish event
    setTimeout(() => {
      const logCall = (console.log as jest.Mock).mock.calls[0][0] as string;
      const logData = JSON.parse(logCall);
      const duration = parseInt((logData.duration as string).replace('ms', ''), 10);
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(Date.now() - startTime + 100);
      done();
    }, 10);
  });
});
