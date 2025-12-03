import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { KeyDistributorService } from './key-distributor.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as jose from 'jose';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('node:path');
jest.mock('jose');

// Interface for accessing private methods in tests
interface KeyDistributorServiceTestable {
  ensureKeysDirectory(): Promise<string>;
  generateKeyPair(): Promise<{ publicKeyPEM: string; privateKeyPEM: string }>;
  fileExists(filePath: string): Promise<boolean>;
  loadOrGenerateKeys(): Promise<{ publicKeyPEM: string; privateKeyPEM: string }>;
  initializeAndPublishKeys(): Promise<void>;
  publicKey: string;
  handlePublicKeyRequest(): { publicKey: string; algorithm: string; issuedAt: string };
  getPublicKey(): string;
}

describe('KeyDistributorService', () => {
  let service: KeyDistributorService;
  let mockClientProxy: jest.Mocked<ClientProxy>;

  const mockPublicKeyPEM = '-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----';
  const mockPrivateKeyPEM = '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----';

  beforeEach(async () => {
    mockClientProxy = {
      send: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    // Reset all mocks
    jest.clearAllMocks();
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue(mockPublicKeyPEM);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyDistributorService,
        {
          provide: 'NATS_CLIENT',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<KeyDistributorService>(KeyDistributorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize and publish keys successfully', async () => {
      // Mock fileExists to return false (keys don't exist)
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      // Mock generateKeyPair
      const mockPublicKey = { type: 'public' };
      const mockPrivateKey = { type: 'private' };
      (jose.generateKeyPair as jest.Mock).mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
      });
      (jose.exportSPKI as jest.Mock).mockResolvedValue(mockPublicKeyPEM);
      (jose.exportPKCS8 as jest.Mock).mockResolvedValue(mockPrivateKeyPEM);

      await service.onModuleInit();

      expect(fs.mkdir).toHaveBeenCalled();
      expect(jose.generateKeyPair).toHaveBeenCalledWith('RS256', {
        modulusLength: 2048,
        extractable: true,
      });
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should throw error if initialization fails', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (jose.generateKeyPair as jest.Mock).mockRejectedValue(new Error('Key generation failed'));

      await expect(service.onModuleInit()).rejects.toThrow('Key generation failed');
    });
  });

  describe('ensureKeysDirectory', () => {
    it('should create keys directory if it does not exist', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (path.join as jest.Mock).mockReturnValue('/app/keys');

      // Access private method via type assertion for testing
      const keysDir = await (service as unknown as KeyDistributorServiceTestable).ensureKeysDirectory();

      expect(fs.mkdir).toHaveBeenCalledWith('/app/keys', { recursive: true });
      expect(keysDir).toBe('/app/keys');
    });

    it('should throw error if directory creation fails', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect((service as unknown as KeyDistributorServiceTestable).ensureKeysDirectory()).rejects.toThrow(
        'Permission denied',
      );
    });
  });

  describe('generateKeyPair', () => {
    it('should generate RSA key pair successfully', async () => {
      const mockPublicKey = { type: 'public' };
      const mockPrivateKey = { type: 'private' };
      (jose.generateKeyPair as jest.Mock).mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
      });
      (jose.exportSPKI as jest.Mock).mockResolvedValue(mockPublicKeyPEM);
      (jose.exportPKCS8 as jest.Mock).mockResolvedValue(mockPrivateKeyPEM);

      const result = await (service as unknown as KeyDistributorServiceTestable).generateKeyPair();

      expect(jose.generateKeyPair).toHaveBeenCalledWith('RS256', {
        modulusLength: 2048,
        extractable: true,
      });
      expect(jose.exportSPKI).toHaveBeenCalledWith(mockPublicKey);
      expect(jose.exportPKCS8).toHaveBeenCalledWith(mockPrivateKey);
      expect(result).toEqual({
        publicKeyPEM: mockPublicKeyPEM,
        privateKeyPEM: mockPrivateKeyPEM,
      });
    });

    it('should throw error if key generation fails', async () => {
      (jose.generateKeyPair as jest.Mock).mockRejectedValue(new Error('Key generation failed'));

      await expect((service as unknown as KeyDistributorServiceTestable).generateKeyPair()).rejects.toThrow(
        'Key generation failed',
      );
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await (service as unknown as KeyDistributorServiceTestable).fileExists('/path/to/file');

      expect(fs.access).toHaveBeenCalledWith('/path/to/file');
      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await (service as unknown as KeyDistributorServiceTestable).fileExists('/path/to/file');

      expect(fs.access).toHaveBeenCalledWith('/path/to/file');
      expect(result).toBe(false);
    });
  });

  describe('loadOrGenerateKeys', () => {
    it('should load existing keys from disk', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined); // File exists
      (fs.readFile as jest.Mock).mockResolvedValueOnce(mockPrivateKeyPEM).mockResolvedValueOnce(mockPublicKeyPEM);
      (path.join as jest.Mock).mockReturnValue('/app/keys');

      const result = await (service as unknown as KeyDistributorServiceTestable).loadOrGenerateKeys();

      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        publicKeyPEM: mockPublicKeyPEM,
        privateKeyPEM: mockPrivateKeyPEM,
      });
    });

    it('should generate new keys if they do not exist', async () => {
      // Mock fileExists to return false
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      // Mock generateKeyPair
      const mockPublicKey = { type: 'public' };
      const mockPrivateKey = { type: 'private' };
      (jose.generateKeyPair as jest.Mock).mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
      });
      (jose.exportSPKI as jest.Mock).mockResolvedValue(mockPublicKeyPEM);
      (jose.exportPKCS8 as jest.Mock).mockResolvedValue(mockPrivateKeyPEM);
      (path.join as jest.Mock).mockReturnValue('/app/keys');

      const result = await (service as unknown as KeyDistributorServiceTestable).loadOrGenerateKeys();

      expect(jose.generateKeyPair).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        publicKeyPEM: mockPublicKeyPEM,
        privateKeyPEM: mockPrivateKeyPEM,
      });
    });

    it('should throw error if loading or generating fails', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (jose.generateKeyPair as jest.Mock).mockRejectedValue(new Error('Key generation failed'));

      await expect((service as unknown as KeyDistributorServiceTestable).loadOrGenerateKeys()).rejects.toThrow(
        'Key generation failed',
      );
    });

    it('should generate new keys if only one key exists', async () => {
      // Mock private key exists but public key doesn't
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // private key exists
        .mockRejectedValueOnce(new Error('File not found')); // public key doesn't exist

      // Mock generateKeyPair
      const mockPublicKey = { type: 'public' };
      const mockPrivateKey = { type: 'private' };
      (jose.generateKeyPair as jest.Mock).mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
      });
      (jose.exportSPKI as jest.Mock).mockResolvedValue(mockPublicKeyPEM);
      (jose.exportPKCS8 as jest.Mock).mockResolvedValue(mockPrivateKeyPEM);

      const result = await (service as unknown as KeyDistributorServiceTestable).loadOrGenerateKeys();

      expect(jose.generateKeyPair).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        publicKeyPEM: mockPublicKeyPEM,
        privateKeyPEM: mockPrivateKeyPEM,
      });
    });
  });

  describe('initializeAndPublishKeys', () => {
    it('should initialize keys successfully', async () => {
      // Mock loadOrGenerateKeys
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      const mockPublicKey = { type: 'public' };
      const mockPrivateKey = { type: 'private' };
      (jose.generateKeyPair as jest.Mock).mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
      });
      (jose.exportSPKI as jest.Mock).mockResolvedValue(mockPublicKeyPEM);
      (jose.exportPKCS8 as jest.Mock).mockResolvedValue(mockPrivateKeyPEM);

      await (service as unknown as KeyDistributorServiceTestable).initializeAndPublishKeys();

      expect((service as unknown as KeyDistributorServiceTestable).publicKey).toBe(mockPublicKeyPEM);
    });

    it('should throw error if initialization fails', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (jose.generateKeyPair as jest.Mock).mockRejectedValue(new Error('Key generation failed'));

      await expect((service as unknown as KeyDistributorServiceTestable).initializeAndPublishKeys()).rejects.toThrow(
        'Key generation failed',
      );
    });
  });

  describe('handlePublicKeyRequest', () => {
    it('should return public key with algorithm and issuedAt', () => {
      // Set public key first
      (service as unknown as KeyDistributorServiceTestable).publicKey = mockPublicKeyPEM;

      const result = service.handlePublicKeyRequest();

      expect(result).toEqual({
        publicKey: mockPublicKeyPEM,
        algorithm: 'RS256',
        issuedAt: expect.any(String),
      });
      expect(new Date(result.issuedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should return empty string if public key not initialized', () => {
      (service as unknown as KeyDistributorServiceTestable).publicKey = '';

      const result = service.handlePublicKeyRequest();

      expect(result.publicKey).toBe('');
      expect(result.algorithm).toBe('RS256');
    });
  });

  describe('getPublicKey', () => {
    it('should return the current public key', () => {
      (service as unknown as KeyDistributorServiceTestable).publicKey = mockPublicKeyPEM;

      const result = service.getPublicKey();

      expect(result).toBe(mockPublicKeyPEM);
    });

    it('should return empty string if public key not set', () => {
      (service as unknown as KeyDistributorServiceTestable).publicKey = '';

      const result = service.getPublicKey();

      expect(result).toBe('');
    });
  });
});
