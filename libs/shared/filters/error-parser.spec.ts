import { HttpStatus } from '@nestjs/common';
import { ErrorParser } from './error-parser';

describe('ErrorParser', () => {
  describe('parse', () => {
    it('should parse object error with statusCode and message', () => {
      const error = {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        error: 'Not Found',
      };

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        details: 'Not Found',
      });
    });

    it('should parse object error with default values when missing fields', () => {
      const error = {};

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        details: null,
      });
    });

    it('should parse object error with only message', () => {
      const error = {
        message: 'Custom error message',
      };

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Custom error message',
        details: null,
      });
    });

    it('should parse string error with empty response pattern', () => {
      const error = 'Service returned empty response';

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        details: null,
      });
    });

    it('should parse string error with timeout pattern', () => {
      const error = 'Request timeout occurred';

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.REQUEST_TIMEOUT,
        message: 'Request timeout - service did not respond in time',
        details: null,
      });
    });

    it('should parse string error with not found pattern', () => {
      const error = 'Resource not found';

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        details: null,
      });
    });

    it('should parse string error with unauthorized pattern', () => {
      const error = 'User unauthorized';

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'User unauthorized',
        details: null,
      });
    });

    it('should parse string error with forbidden pattern', () => {
      const error = 'Access forbidden';

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Access forbidden',
        details: null,
      });
    });

    it('should parse string error with default statusCode for unknown pattern', () => {
      const error = 'Some unknown error';

      const result = ErrorParser.parse(error);

      expect(result).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Some unknown error',
        details: null,
      });
    });

    it('should parse null as default error', () => {
      const result = ErrorParser.parse(null as unknown as string);

      expect(result).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        details: null,
      });
    });

    it('should be case-insensitive when parsing string errors', () => {
      const error = 'NOT FOUND';

      const result = ErrorParser.parse(error);

      expect(result.statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it('should handle object error with invalid statusCode type', () => {
      const error = {
        statusCode: 'invalid',
        message: 'Error message',
      };

      const result = ErrorParser.parse(error);

      expect(result.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe('Error message');
    });
  });

  describe('extractMessage', () => {
    it('should extract message from string error', () => {
      const error = 'Error message';

      const result = ErrorParser.extractMessage(error);

      expect(result).toBe('Error message');
    });

    it('should extract message from object error', () => {
      const error = {
        message: 'Error message from object',
      };

      const result = ErrorParser.extractMessage(error);

      expect(result).toBe('Error message from object');
    });

    it('should return default message when object has no message field', () => {
      const error = {};

      const result = ErrorParser.extractMessage(error);

      expect(result).toBe('Internal server error');
    });

    it('should return default message for null error', () => {
      const result = ErrorParser.extractMessage(null as unknown as string);

      expect(result).toBe('Internal server error');
    });
  });

  describe('extractStatusCode', () => {
    it('should extract statusCode from object error', () => {
      const error = {
        statusCode: HttpStatus.NOT_FOUND,
      };

      const result = ErrorParser.extractStatusCode(error);

      expect(result).toBe(HttpStatus.NOT_FOUND);
    });

    it('should return default statusCode for string error', () => {
      const error = 'Error message';

      const result = ErrorParser.extractStatusCode(error);

      expect(result).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return default statusCode when object has no statusCode field', () => {
      const error = {};

      const result = ErrorParser.extractStatusCode(error);

      expect(result).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return default statusCode for null error', () => {
      const result = ErrorParser.extractStatusCode(null as unknown as string);

      expect(result).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
