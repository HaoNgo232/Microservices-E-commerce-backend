import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { AllRpcExceptionsFilter } from './rpc-exception.filter';
import { ErrorParser } from './error-parser';
import { ErrorResponseBuilder } from './error-response-builder';

// Mock dependencies
jest.mock('./error-parser');
jest.mock('./error-response-builder');

describe('AllRpcExceptionsFilter', () => {
  let filter: AllRpcExceptionsFilter;
  let mockArgumentsHost: jest.Mocked<ArgumentsHost>;
  let mockResponse: jest.Mocked<{ status: jest.Mock; json: jest.Mock }>;

  beforeEach(() => {
    filter = new AllRpcExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockArgumentsHost = {
      getType: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as jest.Mocked<ArgumentsHost>;

    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('catch - HTTP context', () => {
    it('should handle RpcException in HTTP context', () => {
      mockArgumentsHost.getType.mockReturnValue('http');
      const rpcException = new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
      });

      const mockParsedError = {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        details: null,
      };
      (ErrorParser.parse as jest.Mock).mockReturnValue(mockParsedError);

      const mockHttpResponse = {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        timestamp: new Date().toISOString(),
      };
      (ErrorResponseBuilder.buildHttpResponse as jest.Mock).mockReturnValue(mockHttpResponse);

      const result = filter.catch(rpcException, mockArgumentsHost);

      expect(mockArgumentsHost.getType).toHaveBeenCalled();
      expect(ErrorParser.parse).toHaveBeenCalled();
      expect(ErrorResponseBuilder.buildHttpResponse).toHaveBeenCalledWith(
        HttpStatus.NOT_FOUND,
        'Resource not found',
        null,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHttpResponse);
      expect(result).toBeDefined();
    });

    it('should handle Error in HTTP context', () => {
      mockArgumentsHost.getType.mockReturnValue('http');
      const error = new Error('Generic error');

      const mockParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Generic error',
        details: null,
      };
      (ErrorParser.parse as jest.Mock).mockReturnValue(mockParsedError);

      const mockHttpResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Generic error',
        timestamp: new Date().toISOString(),
      };
      (ErrorResponseBuilder.buildHttpResponse as jest.Mock).mockReturnValue(mockHttpResponse);

      filter.catch(error as unknown as RpcException, mockArgumentsHost);

      expect(ErrorParser.parse).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('catch - RPC context', () => {
    it('should handle RpcException in RPC context', () => {
      mockArgumentsHost.getType.mockReturnValue('rpc');
      const rpcException = new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
      });

      (ErrorParser.extractStatusCode as jest.Mock).mockReturnValue(HttpStatus.NOT_FOUND);
      (ErrorParser.extractMessage as jest.Mock).mockReturnValue('Resource not found');

      const mockRpcResponse = {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        timestamp: new Date().toISOString(),
      };
      (ErrorResponseBuilder.buildRpcResponse as jest.Mock).mockReturnValue(mockRpcResponse);

      const result = filter.catch(rpcException, mockArgumentsHost);

      expect(ErrorParser.extractStatusCode).toHaveBeenCalled();
      expect(ErrorParser.extractMessage).toHaveBeenCalled();
      expect(ErrorResponseBuilder.buildRpcResponse).toHaveBeenCalledWith(HttpStatus.NOT_FOUND, 'Resource not found');
      expect(result).toBeDefined();
    });

    it('should handle Error in RPC context', () => {
      mockArgumentsHost.getType.mockReturnValue('rpc');
      const error = new Error('Generic error');

      (ErrorParser.extractStatusCode as jest.Mock).mockReturnValue(HttpStatus.INTERNAL_SERVER_ERROR);
      (ErrorParser.extractMessage as jest.Mock).mockReturnValue('Generic error');

      const mockRpcResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Generic error',
        timestamp: new Date().toISOString(),
      };
      (ErrorResponseBuilder.buildRpcResponse as jest.Mock).mockReturnValue(mockRpcResponse);

      filter.catch(error as unknown as RpcException, mockArgumentsHost);

      expect(ErrorParser.extractStatusCode).toHaveBeenCalled();
      expect(ErrorParser.extractMessage).toHaveBeenCalled();
    });
  });

  describe('normalizeException', () => {
    it('should return RpcException error as-is', () => {
      mockArgumentsHost.getType.mockReturnValue('http');
      const rpcException = new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not found',
      });

      (ErrorParser.parse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not found',
        details: null,
      });
      (ErrorResponseBuilder.buildHttpResponse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not found',
        timestamp: new Date().toISOString(),
      });

      filter.catch(rpcException, mockArgumentsHost);

      expect(ErrorParser.parse).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not found',
      });
    });

    it('should normalize Error with getStatus method (HttpException-like)', () => {
      mockArgumentsHost.getType.mockReturnValue('http');
      // Create actual Error instance and add methods
      const error = new Error('Error message') as Error & {
        getStatus?: () => number;
        getResponse?: () => string | object;
      };
      error.getStatus = jest.fn().mockReturnValue(HttpStatus.BAD_REQUEST);
      error.getResponse = jest.fn().mockReturnValue('Bad request');

      (ErrorParser.parse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad request',
        details: null,
      });
      (ErrorResponseBuilder.buildHttpResponse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad request',
        timestamp: new Date().toISOString(),
      });

      filter.catch(error as unknown as RpcException, mockArgumentsHost);

      // The normalizeException extracts message from getResponse
      expect(ErrorParser.parse).toHaveBeenCalled();
      const parseCall = (ErrorParser.parse as jest.Mock).mock.calls[0][0];
      expect(parseCall.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(parseCall.message).toBe('Bad request');
    });

    it('should normalize Error with getResponse returning object', () => {
      mockArgumentsHost.getType.mockReturnValue('http');
      // Create actual Error instance and add methods
      const error = new Error('Error message') as Error & {
        getStatus?: () => number;
        getResponse?: () => string | object;
      };
      error.getStatus = jest.fn().mockReturnValue(HttpStatus.BAD_REQUEST);
      error.getResponse = jest.fn().mockReturnValue({ message: 'Object response' });

      (ErrorParser.parse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Object response',
        details: null,
      });
      (ErrorResponseBuilder.buildHttpResponse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Object response',
        timestamp: new Date().toISOString(),
      });

      filter.catch(error as unknown as RpcException, mockArgumentsHost);

      // The normalizeException extracts message from object response
      expect(ErrorParser.parse).toHaveBeenCalled();
      const parseCall = (ErrorParser.parse as jest.Mock).mock.calls[0][0];
      expect(parseCall.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(parseCall.message).toBe('Object response');
    });

    it('should normalize generic Error to default format', () => {
      mockArgumentsHost.getType.mockReturnValue('http');
      const error = new Error('Generic error');

      (ErrorParser.parse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Generic error',
        details: null,
      });
      (ErrorResponseBuilder.buildHttpResponse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Generic error',
        timestamp: new Date().toISOString(),
      });

      filter.catch(error as unknown as RpcException, mockArgumentsHost);

      expect(ErrorParser.parse).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Generic error',
      });
    });

    it('should handle Error without message', () => {
      mockArgumentsHost.getType.mockReturnValue('http');
      const error = new Error();

      (ErrorParser.parse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        details: null,
      });
      (ErrorResponseBuilder.buildHttpResponse as jest.Mock).mockReturnValue({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });

      filter.catch(error as unknown as RpcException, mockArgumentsHost);

      expect(ErrorParser.parse).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
    });
  });
});
