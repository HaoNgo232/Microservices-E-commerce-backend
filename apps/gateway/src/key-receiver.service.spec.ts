import { Test, TestingModule } from '@nestjs/testing';
import { KeyReceiverService } from './key-receiver.service';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

describe('KeyReceiverService', () => {
  let service: KeyReceiverService;
  let mockClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const mockClientProxy = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyReceiverService,
        {
          provide: 'NATS_CLIENT',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<KeyReceiverService>(KeyReceiverService);
    mockClient = module.get('NATS_CLIENT');

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should successfully receive public key on initialization', async () => {
      // Arrange
      const mockPublicKey = {
        publicKey: 'test-public-key',
        algorithm: 'RS256',
        issuedAt: new Date().toISOString(),
      };
      mockClient.send.mockReturnValue(of(mockPublicKey));

      // Act
      await service.onModuleInit();

      // Assert
      expect(mockClient.send).toHaveBeenCalledWith('auth.public-key', {});
      expect(service.isKeyAvailable()).toBe(true);
    });

    it('should retry on failure and eventually succeed', async () => {
      // Arrange
      const mockPublicKey = {
        publicKey: 'test-public-key',
        algorithm: 'RS256',
        issuedAt: new Date().toISOString(),
      };
      mockClient.send
        .mockReturnValueOnce(throwError(() => new Error('Service unavailable')))
        .mockReturnValueOnce(throwError(() => new Error('Timeout')))
        .mockReturnValueOnce(of(mockPublicKey));

      // Act
      await service.onModuleInit();

      // Assert
      expect(mockClient.send).toHaveBeenCalledTimes(3);
      expect(service.isKeyAvailable()).toBe(true);
    });

    it('should throw error after max retries', async () => {
      // Arrange
      mockClient.send.mockReturnValue(throwError(() => new Error('Service unavailable')));

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow('Không nhận được public key sau 5 lần thử');
      expect(mockClient.send).toHaveBeenCalledTimes(5);
    });

    it('should handle invalid public key response', async () => {
      // Arrange
      mockClient.send
        .mockReturnValueOnce(of(null))
        .mockReturnValueOnce(of({}))
        .mockReturnValueOnce(of({ publicKey: 'valid-key', algorithm: 'RS256', issuedAt: new Date().toISOString() }));

      // Act
      await service.onModuleInit();

      // Assert
      expect(mockClient.send).toHaveBeenCalledTimes(3);
      expect(service.isKeyAvailable()).toBe(true);
    });
  });

  describe('getPublicKey', () => {
    it('should return cached public key if available', async () => {
      // Arrange
      const mockPublicKey = {
        publicKey: 'test-public-key',
        algorithm: 'RS256',
        issuedAt: new Date().toISOString(),
      };
      mockClient.send.mockReturnValue(of(mockPublicKey));
      await service.onModuleInit();

      // Act
      const result = await service.getPublicKey();

      // Assert
      expect(result).toBe('test-public-key');
      expect(mockClient.send).toHaveBeenCalledTimes(1); // Only called during init
    });

    it('should wait for key if not yet available', async () => {
      // Arrange
      const mockPublicKey = {
        publicKey: 'test-public-key',
        algorithm: 'RS256',
        issuedAt: new Date().toISOString(),
      };
      mockClient.send.mockReturnValue(of(mockPublicKey));

      // Act - call getPublicKey before init completes
      const keyPromise = service.getPublicKey();
      await service.onModuleInit();
      const result = await keyPromise;

      // Assert
      expect(result).toBe('test-public-key');
    });
  });

  describe('isKeyAvailable', () => {
    it('should return false when key not yet received', () => {
      // Assert
      expect(service.isKeyAvailable()).toBe(false);
    });

    it('should return true after key is received', async () => {
      // Arrange
      const mockPublicKey = {
        publicKey: 'test-public-key',
        algorithm: 'RS256',
        issuedAt: new Date().toISOString(),
      };
      mockClient.send.mockReturnValue(of(mockPublicKey));

      // Act
      await service.onModuleInit();

      // Assert
      expect(service.isKeyAvailable()).toBe(true);
    });
  });

  describe('getPublicKeySync', () => {
    it('should return public key synchronously when available', async () => {
      // Arrange
      const mockPublicKey = {
        publicKey: 'test-public-key',
        algorithm: 'RS256',
        issuedAt: new Date().toISOString(),
      };
      mockClient.send.mockReturnValue(of(mockPublicKey));
      await service.onModuleInit();

      // Act
      const result = service.getPublicKeySync();

      // Assert
      expect(result).toBe('test-public-key');
    });

    it('should throw error when key not yet available', () => {
      // Act & Assert
      expect(() => service.getPublicKeySync()).toThrow('Public key not yet received from user-app');
    });
  });
});
