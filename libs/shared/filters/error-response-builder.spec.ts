import { HttpStatus } from '@nestjs/common';
import { ErrorResponseBuilder } from './error-response-builder';

describe('ErrorResponseBuilder', () => {
  describe('buildHttpResponse', () => {
    it('should build HTTP response with statusCode and message', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(HttpStatus.NOT_FOUND, 'Resource not found', null);

      expect(result).toMatchObject({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        timestamp: expect.any(String),
      });
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should include details when provided', () => {
      const details = { userId: '123', resourceId: '456' };

      const result = ErrorResponseBuilder.buildHttpResponse(HttpStatus.BAD_REQUEST, 'Validation failed', details);

      expect(result.details).toEqual(details);
    });

    it('should include error field for 5xx status codes', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Internal server error',
        null,
      );

      expect(result.error).toBe('Internal Server Error');
    });

    it('should include error field for 500 status code', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(500, 'Server error', null);

      expect(result.error).toBe('Internal Server Error');
    });

    it('should not include error field for 4xx status codes', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(HttpStatus.BAD_REQUEST, 'Bad request', null);

      expect(result.error).toBeUndefined();
    });

    it('should not include error field for 3xx status codes', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(HttpStatus.MOVED_PERMANENTLY, 'Moved', null);

      expect(result.error).toBeUndefined();
    });

    it('should not include error field for 2xx status codes', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(HttpStatus.OK, 'Success', null);

      expect(result.error).toBeUndefined();
    });

    it('should include error field for 502 status code', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(502, 'Bad gateway', null);

      expect(result.error).toBe('Internal Server Error');
    });

    it('should not include details field when details is null', () => {
      const result = ErrorResponseBuilder.buildHttpResponse(HttpStatus.NOT_FOUND, 'Not found', null);

      expect(result.details).toBeUndefined();
    });

    it('should include details field when details is provided', () => {
      const details = { field: 'value' };

      const result = ErrorResponseBuilder.buildHttpResponse(HttpStatus.BAD_REQUEST, 'Error', details);

      expect(result.details).toBe(details);
    });
  });

  describe('buildRpcResponse', () => {
    it('should build RPC response with statusCode and message', () => {
      const result = ErrorResponseBuilder.buildRpcResponse(HttpStatus.NOT_FOUND, 'Resource not found');

      expect(result).toEqual({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        timestamp: expect.any(String),
      });
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should include timestamp in ISO format', () => {
      const result = ErrorResponseBuilder.buildRpcResponse(HttpStatus.BAD_REQUEST, 'Bad request');

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle different status codes', () => {
      const result1 = ErrorResponseBuilder.buildRpcResponse(HttpStatus.OK, 'Success');
      const result2 = ErrorResponseBuilder.buildRpcResponse(HttpStatus.UNAUTHORIZED, 'Unauthorized');
      const result3 = ErrorResponseBuilder.buildRpcResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Server error');

      expect(result1.statusCode).toBe(HttpStatus.OK);
      expect(result2.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(result3.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
