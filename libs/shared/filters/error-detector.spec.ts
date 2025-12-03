import { HttpStatus } from '@nestjs/common';
import { ErrorDetector, ParsedError } from './error-detector';

describe('ErrorDetector', () => {
  let detector: ErrorDetector;

  beforeEach(() => {
    detector = new ErrorDetector();
  });

  describe('enhance', () => {
    it('should return parsed error unchanged if statusCode is not 500', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result).toEqual(parsedError);
    });

    it('should enhance error with SERVICE_UNAVAILABLE for empty response pattern', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Service returned empty response',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(result.message).toBe('Service temporarily unavailable');
    });

    it('should enhance error with REQUEST_TIMEOUT for timeout pattern', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Request timeout occurred',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.REQUEST_TIMEOUT);
      expect(result.message).toBe('Request timeout - service did not respond in time');
    });

    it('should enhance error with NOT_FOUND for not found pattern', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Resource not found',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(result.message).toBe('Resource not found'); // Uses original message
    });

    it('should enhance error with UNAUTHORIZED for unauthorized pattern', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'User unauthorized',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(result.message).toBe('User unauthorized');
    });

    it('should enhance error with FORBIDDEN for forbidden pattern', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Access forbidden',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(result.message).toBe('Access forbidden');
    });

    it('should enhance error with BAD_REQUEST for bad request pattern', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Invalid bad request',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.message).toBe('Invalid bad request');
    });

    it('should enhance error with CONFLICT for conflict pattern', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Resource conflict detected',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.CONFLICT);
      expect(result.message).toBe('Resource conflict detected');
    });

    it('should return unchanged error if no pattern matches', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Some unknown error occurred',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result).toEqual(parsedError);
    });

    it('should be case-insensitive when matching patterns', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'NOT FOUND',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it('should preserve details when enhancing', () => {
      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Resource not found',
        details: { userId: '123', resourceId: '456' },
      };

      const result = detector.enhance(parsedError);

      expect(result.details).toEqual({ userId: '123', resourceId: '456' });
    });
  });

  describe('addPattern', () => {
    it('should add custom pattern and use it for enhancement', () => {
      detector.addPattern({
        keywords: ['custom error'],
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Custom error message',
      });

      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'A custom error occurred',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(result.message).toBe('Custom error message');
    });

    it('should allow multiple custom patterns', () => {
      detector.addPattern({
        keywords: ['pattern1'],
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
      detector.addPattern({
        keywords: ['pattern2'],
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      });

      const error1: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'pattern1 detected',
        details: null,
      };
      const error2: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'pattern2 detected',
        details: null,
      };

      expect(detector.enhance(error1).statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(detector.enhance(error2).statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should use first matching pattern when multiple patterns match', () => {
      detector.addPattern({
        keywords: ['test'],
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'First pattern',
      });
      detector.addPattern({
        keywords: ['test'],
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Second pattern',
      });

      const parsedError: ParsedError = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'test error',
        details: null,
      };

      const result = detector.enhance(parsedError);

      expect(result.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(result.message).toBe('First pattern');
    });
  });
});
