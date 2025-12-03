/* eslint-disable @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as jose from 'jose';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Import services
import { JwtService } from './jwt.service';
import { FileReaderService } from '../utils/file-reader.service';

describe('JwtService', () => {
  let service: JwtService;
  let publicKey: jose.KeyLike;
  let privateKey: jose.KeyLike;
  let publicKeyPEM: string;
  let privateKeyPEM: string;

  beforeAll(async () => {
    // Generate test RSA keys
    const keyPair = await jose.generateKeyPair('RS256', {
      modulusLength: 2048,
    });
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;

    // Export to PEM format
    publicKeyPEM = await jose.exportSPKI(publicKey);
    privateKeyPEM = await jose.exportPKCS8(privateKey);
  });

  beforeEach(async () => {
    // Mock FileReaderService
    const mockFileReaderService = {
      readFile: jest.fn((path: string) => {
        if (path.includes('public-key.pem')) {
          return Promise.resolve(publicKeyPEM);
        }
        if (path.includes('private-key.pem')) {
          return Promise.resolve(privateKeyPEM);
        }
        return Promise.reject(new Error('File not found'));
      }),
      fileExists: jest.fn((path: string) => {
        if (path.includes('private-key.pem')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: FileReaderService,
          useValue: mockFileReaderService,
        },
      ],
    }).compile();

    service = module.get<JwtService>(JwtService);
    await service.onModuleInit();
  });

  afterAll(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  describe('Module Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load keys successfully on init', async () => {
      expect(service.canVerifyTokens()).toBe(true);
      expect(service.canSignTokens()).toBe(true);
    });

    it('should throw error if public key is missing', async () => {
      // Mock: public key file not found
      const mockFileReader = {
        readFile: jest.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
        fileExists: jest.fn().mockResolvedValue(false),
      };

      const testService = new JwtService(mockFileReader as unknown as FileReaderService);

      await expect(testService.onModuleInit()).rejects.toThrow('JWT key initialization failed');
    });

    it('should handle non-Error exceptions in loadKeys', async () => {
      // Test line 97 branch: error instanceof Error ? error.message : 'Unknown error'
      const mockFileReader = {
        readFile: jest.fn().mockRejectedValue('String error'), // Non-Error object
        fileExists: jest.fn().mockResolvedValue(false),
      };

      const testService = new JwtService(mockFileReader as unknown as FileReaderService);

      await expect(testService.onModuleInit()).rejects.toThrow('JWT key initialization failed');
      await expect(testService.onModuleInit()).rejects.toThrow('Unknown error');
    });

    it('should work without private key (verification-only mode)', async () => {
      // Mock: only public key available, private key missing
      const mockFileReader = {
        readFile: jest.fn((path: string) => {
          if (path.includes('public-key.pem')) {
            return Promise.resolve(publicKeyPEM);
          }
          return Promise.reject(new Error('ENOENT: no such file or directory'));
        }),
        fileExists: jest.fn((path: string) => {
          if (path.includes('private-key.pem')) {
            return Promise.resolve(false);
          }
          return Promise.resolve(false);
        }),
      };

      const testService = new JwtService(mockFileReader as unknown as FileReaderService);
      await testService.onModuleInit();

      expect(testService.canVerifyTokens()).toBe(true);
      expect(testService.canSignTokens()).toBe(false);
    });

    it('should load keys from KeyReceiverService when available', async () => {
      const mockKeyReceiverService = {
        getPublicKey: jest.fn().mockResolvedValue(publicKeyPEM),
      };

      const mockFileReader = {
        readFile: jest.fn(),
        fileExists: jest.fn().mockResolvedValue(false),
      };

      const testService = new JwtService(
        mockFileReader as unknown as FileReaderService,
        mockKeyReceiverService as unknown as { getPublicKey: () => Promise<string> },
      );

      await testService.onModuleInit();

      expect(mockKeyReceiverService.getPublicKey).toHaveBeenCalled();
      expect(testService.canVerifyTokens()).toBe(true);
      expect(mockFileReader.readFile).not.toHaveBeenCalled(); // Should not fall back to file
    });

    it('should fall back to file-based keys when KeyReceiverService fails', async () => {
      const mockKeyReceiverService = {
        getPublicKey: jest.fn().mockRejectedValue(new Error('KeyReceiverService error')),
      };

      const mockFileReader = {
        readFile: jest.fn((path: string) => {
          if (path.includes('public-key.pem')) {
            return Promise.resolve(publicKeyPEM);
          }
          return Promise.reject(new Error('File not found'));
        }),
        fileExists: jest.fn().mockResolvedValue(false),
      };

      const testService = new JwtService(
        mockFileReader as unknown as FileReaderService,
        mockKeyReceiverService as unknown as { getPublicKey: () => Promise<string> },
      );

      await testService.onModuleInit();

      expect(mockKeyReceiverService.getPublicKey).toHaveBeenCalled();
      expect(mockFileReader.readFile).toHaveBeenCalled(); // Should fall back to file
      expect(testService.canVerifyTokens()).toBe(true);
    });
  });

  describe('Token Signing', () => {
    const testPayload = {
      sub: 'test-user-123',
      email: 'test@example.com',
      role: 'CUSTOMER',
    };

    it('should throw error if payload missing sub claim', async () => {
      const payloadWithoutSub = {
        email: 'test@example.com',
        role: 'CUSTOMER',
      };

      await expect(service.signToken(payloadWithoutSub as jose.JWTPayload, 900)).rejects.toThrow(UnauthorizedException);
      await expect(service.signToken(payloadWithoutSub as jose.JWTPayload, 900)).rejects.toThrow(
        'Token payload must contain sub claim',
      );
    });

    it('should handle signing errors gracefully', async () => {
      // Test error handling in signToken catch block (lines 133-134)
      // Mock jose.SignJWT to throw an error during signing
      const originalSignJWT = jose.SignJWT;
      const mockSignJWT = jest.fn().mockImplementation(() => {
        const mockInstance = {
          setProtectedHeader: jest.fn().mockReturnThis(),
          setIssuedAt: jest.fn().mockReturnThis(),
          setIssuer: jest.fn().mockReturnThis(),
          setExpirationTime: jest.fn().mockReturnThis(),
          setSubject: jest.fn().mockReturnThis(),
          sign: jest.fn().mockRejectedValue(new Error('Signing failed')),
        };
        return mockInstance;
      });

      // Replace SignJWT temporarily
      Object.defineProperty(jose, 'SignJWT', {
        value: mockSignJWT,
        writable: true,
        configurable: true,
      });

      const payload = { sub: 'test-123', email: 'test@example.com' };
      await expect(service.signToken(payload, 900)).rejects.toThrow(UnauthorizedException);
      await expect(service.signToken(payload, 900)).rejects.toThrow('Failed to sign JWT token');

      // Restore
      Object.defineProperty(jose, 'SignJWT', {
        value: originalSignJWT,
        writable: true,
        configurable: true,
      });
    });

    it('should sign a valid JWT token', async () => {
      const token = await service.signToken(testPayload, 900);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should sign token with correct expiration', async () => {
      const expiresIn = 60; // 1 minute
      const token = await service.signToken(testPayload, expiresIn);

      const decoded = jose.decodeJwt(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      // exp should be approximately iat + expiresIn
      const expectedExp = decoded.iat! + expiresIn;
      expect(decoded.exp).toBeCloseTo(expectedExp, 0);
    });

    it('should include standard JWT claims', async () => {
      const token = await service.signToken(testPayload, 900);
      const decoded = jose.decodeJwt(token);

      expect(decoded.sub).toBe(testPayload.sub); // subject = userId
      expect(decoded.iss).toBe('luan-van-ecommerce'); // issuer
      expect(decoded.iat).toBeDefined(); // issued at
      expect(decoded.exp).toBeDefined(); // expiration
    });

    it('should include custom payload fields', async () => {
      const token = await service.signToken(testPayload, 900);
      const decoded = jose.decodeJwt(token);

      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should throw error if private key not loaded', async () => {
      // Mock: only public key available
      const mockFileReader = {
        readFile: jest.fn((path: string) => {
          if (path.includes('public-key.pem')) {
            return Promise.resolve(publicKeyPEM);
          }
          return Promise.reject(new Error('ENOENT: no such file or directory'));
        }),
        fileExists: jest.fn((path: string) => {
          if (path.includes('private-key.pem')) {
            return Promise.resolve(false);
          }
          return Promise.resolve(false);
        }),
      };

      const testService = new JwtService(mockFileReader as unknown as FileReaderService);
      await testService.onModuleInit();

      const payload = { sub: 'test-123', email: 'test@example.com', role: 'USER' };
      await expect(testService.signToken(payload, 900)).rejects.toThrow('Cannot sign token: Private key not loaded');
    });
  });

  describe('Token Verification', () => {
    const testPayload = {
      sub: 'test-user-456',
      email: 'verify@example.com',
      role: 'ADMIN',
    };

    it('should verify a valid token', async () => {
      const token = await service.signToken(testPayload, 900);
      const verified = await service.verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified.sub).toBe(testPayload.sub);
      expect(verified.email).toBe(testPayload.email);
      expect(verified.role).toBe(testPayload.role);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      // Create a token that expires immediately
      const token = await service.signToken(testPayload, -10); // negative = already expired

      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedException);

      await expect(service.verifyToken(token)).rejects.toThrow('Token has expired');
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      const token = await service.signToken(testPayload, 900);

      // Tamper with the token signature (change multiple characters in signature part)
      const parts = token.split('.');
      const tamperedSignature = parts[2].slice(0, -10) + 'XXXXXXXXXX';
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      await expect(service.verifyToken(tamperedToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for malformed token', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      await expect(service.verifyToken(malformedToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for token with wrong issuer', async () => {
      // Create token with different issuer
      const wrongIssuerToken = await new jose.SignJWT({ ...testPayload })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setIssuer('wrong-issuer') // Different issuer
        .setExpirationTime('15m')
        .setSubject(testPayload.sub)
        .sign(privateKey);

      await expect(service.verifyToken(wrongIssuerToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw error if public key not loaded', async () => {
      // Create service without public key
      const mockFileReader = {
        readFile: jest.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
        fileExists: jest.fn().mockResolvedValue(false),
      };

      const testService = new JwtService(mockFileReader as unknown as FileReaderService);
      await expect(testService.onModuleInit()).rejects.toThrow();

      // Try to verify without public key
      const token = await service.signToken(testPayload, 900);
      await expect(testService.verifyToken(token)).rejects.toThrow('Cannot verify token: Public key not loaded');
    });

    it('should handle generic verification errors', async () => {
      // Test the generic error case (lines 180-181) by mocking jose.jwtVerify to throw a non-jose error
      const token = await service.signToken(testPayload, 900);
      const genericError = new Error('Generic verification error');

      // Mock jose.jwtVerify to throw generic error
      const originalJwtVerify = jose.jwtVerify;
      Object.defineProperty(jose, 'jwtVerify', {
        value: jest.fn().mockRejectedValue(genericError),
        writable: true,
        configurable: true,
      });

      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyToken(token)).rejects.toThrow('Invalid token');

      // Restore
      Object.defineProperty(jose, 'jwtVerify', {
        value: originalJwtVerify,
        writable: true,
        configurable: true,
      });
    });

    it('should validate token structure', async () => {
      const token = await service.signToken(testPayload, 900);
      const verified = await service.verifyToken(token);

      // Standard JWT claims
      expect(verified.iat).toBeDefined();
      expect(verified.exp).toBeDefined();
      expect(verified.iss).toBe('luan-van-ecommerce');
      expect(verified.sub).toBe(testPayload.sub);

      // Custom payload
      expect(verified.sub).toBeDefined();
      expect(verified.email).toBeDefined();
      expect(verified.role).toBeDefined();
    });
  });

  describe('Token Decoding (without verification)', () => {
    const testPayload = {
      sub: 'decode-test-789',
      email: 'decode@example.com',
      role: 'CUSTOMER',
    };

    it('should decode valid token without verification', async () => {
      const token = await service.signToken(testPayload, 900);
      const { payload, header } = service.decodeToken(token);

      expect(payload).toBeDefined();
      expect(header).toBeDefined();

      expect(payload.sub).toBe(testPayload.sub);
      expect(payload.email).toBe(testPayload.email);
      expect(header.alg).toBe('RS256');
    });

    it('should decode expired token (no verification)', async () => {
      const token = await service.signToken(testPayload, -10);

      // Decode should work even for expired tokens
      const { payload } = service.decodeToken(token);
      expect(payload.sub).toBe(testPayload.sub);
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'not-a-valid-token';

      expect(() => service.decodeToken(malformedToken)).toThrow(UnauthorizedException);
    });

    it('should decode token header correctly', async () => {
      const token = await service.signToken(testPayload, 900);
      const { header } = service.decodeToken(token);

      expect(header.alg).toBe('RS256');
      expect(header.typ).toBeUndefined(); // jose might not include typ
    });
  });

  describe('Key Capability Checks', () => {
    it('should report signing capability when private key loaded', () => {
      expect(service.canSignTokens()).toBe(true);
    });

    it('should report verification capability when public key loaded', () => {
      expect(service.canVerifyTokens()).toBe(true);
    });

    it('should report no signing capability without private key', async () => {
      // Mock: only public key available
      const mockFileReader = {
        readFile: jest.fn((path: string) => {
          if (path.includes('public-key.pem')) {
            return Promise.resolve(publicKeyPEM);
          }
          return Promise.reject(new Error('ENOENT: no such file or directory'));
        }),
        fileExists: jest.fn((path: string) => {
          if (path.includes('private-key.pem')) {
            return Promise.resolve(false);
          }
          return Promise.resolve(false);
        }),
      };

      const testService = new JwtService(mockFileReader as unknown as FileReaderService);
      await testService.onModuleInit();

      expect(testService.canSignTokens()).toBe(false);
      expect(testService.canVerifyTokens()).toBe(true);
    });
  });

  describe('Integration: Sign and Verify Flow', () => {
    it('should successfully complete full JWT lifecycle', async () => {
      const payload = {
        sub: 'lifecycle-user-001',
        email: 'lifecycle@example.com',
        role: 'CUSTOMER',
      };

      // 1. Sign token
      const token = await service.signToken(payload, 3600);
      expect(token).toBeDefined();

      // 2. Verify token
      const verified = await service.verifyToken(token);
      expect(verified.sub).toBe(payload.sub);
      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);

      // 3. Decode token (debug)
      const { payload: decoded, header } = service.decodeToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(header.alg).toBe('RS256');
    });

    it('should handle multiple concurrent token operations', async () => {
      const payloads = Array.from({ length: 10 }, (_, i) => ({
        sub: `concurrent-user-${i}`,
        email: `user${i}@example.com`,
        role: 'CUSTOMER',
      }));

      // Sign multiple tokens concurrently
      const tokens = await Promise.all(payloads.map(p => service.signToken(p, 900)));

      expect(tokens).toHaveLength(10);
      expect(tokens.every(t => typeof t === 'string')).toBe(true);

      // Verify all tokens concurrently
      const verifiedPayloads = await Promise.all(tokens.map(t => service.verifyToken(t)));

      expect(verifiedPayloads).toHaveLength(10);
      for (let index = 0; index < verifiedPayloads.length; index++) {
        const verified = verifiedPayloads[index];
        expect(verified.sub).toBe(payloads[index].sub);
        expect(verified.email).toBe(payloads[index].email);
      }
    });
  });
});
