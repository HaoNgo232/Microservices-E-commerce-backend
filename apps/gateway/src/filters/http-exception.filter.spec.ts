import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockRequest: Request;
  let mockResponse: Response;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockRequest = {
      url: '/test',
      method: 'GET',
      body: { test: 'data' },
    } as Request;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ArgumentsHost;

    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should catch and format HttpException with object response', () => {
    // Arrange
    const exception = new HttpException(
      {
        statusCode: 400,
        message: 'Bad Request',
        error: 'Validation Error',
      },
      400,
    );

    // Act
    filter.catch(exception, mockArgumentsHost);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Bad Request',
      error: 'Validation Error',
    });
    expect(console.error).toHaveBeenCalledWith(
      '[HttpExceptionFilter]',
      expect.objectContaining({
        status: 400,
        path: expect.any(String),
        method: expect.any(String),
      }) as Record<string, unknown>,
    );
  });

  it('should catch and format HttpException with string message', () => {
    // Arrange
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    // Act
    filter.catch(exception, mockArgumentsHost);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Not Found',
      error: 'NOT_FOUND',
    });
    expect(console.error).toHaveBeenCalledWith(
      '[HttpExceptionFilter]',
      expect.objectContaining({
        status: 404,
        path: expect.any(String),
        method: expect.any(String),
      }) as Record<string, unknown>,
    );
  });

  it('should handle HttpException with null response', () => {
    // Arrange
    const exception = new HttpException(null as unknown as string, HttpStatus.INTERNAL_SERVER_ERROR);

    // Act
    filter.catch(exception, mockArgumentsHost);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
      }),
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('should log error details correctly', () => {
    // Arrange
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    // Act
    filter.catch(exception, mockArgumentsHost);

    // Assert
    expect(console.error).toHaveBeenCalledWith(
      '[HttpExceptionFilter]',
      expect.objectContaining({
        status: 401,
        path: expect.any(String),
        method: expect.any(String),
      }) as Record<string, unknown>,
    );
  });
});
