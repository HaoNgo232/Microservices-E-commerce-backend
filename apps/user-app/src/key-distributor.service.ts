import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as jose from 'jose';

/**
 * KeyDistributorService - User-app
 *
 * Chức năng:
 * - Generate/load RSA key pair khi module khởi tạo
 * - Publish public key qua NATS để gateway lấy
 * - Subject: auth.public-key
 *
 * Flow:
 * 1. OnModuleInit hook chạy
 * 2. Load/generate keys từ thư mục keys/
 * 3. Publish public key qua NATS
 * 4. Gateway subscribe và cache public key
 */
@Injectable()
export class KeyDistributorService implements OnModuleInit {
  private readonly logger = new Logger(KeyDistributorService.name);
  private publicKey: string = '';

  constructor(@Inject('NATS_CLIENT') private client: ClientProxy) {}

  /**
   * Lifecycle hook: Khởi tạo và publish public key
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.initializeAndPublishKeys();
    } catch (error) {
      this.logger.error('Failed to initialize and publish keys:', error);
      throw error;
    }
  }

  /**
   * Tạo thư mục keys nếu chưa tồn tại
   */
  private async ensureKeysDirectory(): Promise<string> {
    const keysDir = path.join(process.cwd(), 'keys');
    try {
      await fs.mkdir(keysDir, { recursive: true });
      return keysDir;
    } catch (error) {
      this.logger.error('Failed to create keys directory:', error);
      throw error;
    }
  }

  /**
   * Generate RSA key pair (RS256)
   */
  private async generateKeyPair(): Promise<{ publicKeyPEM: string; privateKeyPEM: string }> {
    try {
      this.logger.log('Generating new RSA key pair for JWT...');

      const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
        modulusLength: 2048,
        extractable: true,
      });

      const publicKeyPEM = await jose.exportSPKI(publicKey);
      const privateKeyPEM = await jose.exportPKCS8(privateKey);

      this.logger.log(' RSA key pair generated successfully');

      return { publicKeyPEM, privateKeyPEM };
    } catch (error) {
      this.logger.error('Failed to generate key pair:', error);
      throw error;
    }
  }

  /**
   * Load hoặc generate keys
   * Nếu keys/private-key.pem tồn tại → load
   * Nếu không → generate mới
   */
  private async loadOrGenerateKeys(): Promise<{ publicKeyPEM: string; privateKeyPEM: string }> {
    const keysDir = await this.ensureKeysDirectory();
    const privateKeyPath = path.join(keysDir, 'private-key.pem');
    const publicKeyPath = path.join(keysDir, 'public-key.pem');

    try {
      // Kiểm tra xem keys đã tồn tại
      const privateKeyExists = await this.fileExists(privateKeyPath);
      const publicKeyExists = await this.fileExists(publicKeyPath);

      if (privateKeyExists && publicKeyExists) {
        this.logger.log('Loading existing RSA keys from disk...');
        const privateKeyPEM = await fs.readFile(privateKeyPath, 'utf-8');
        const publicKeyPEM = await fs.readFile(publicKeyPath, 'utf-8');
        this.logger.log(' RSA keys loaded from disk');
        return { publicKeyPEM, privateKeyPEM };
      }

      // Generate keys mới nếu chưa có
      const { publicKeyPEM, privateKeyPEM } = await this.generateKeyPair();

      // Lưu keys vào disk
      await fs.writeFile(privateKeyPath, privateKeyPEM, 'utf-8');
      await fs.writeFile(publicKeyPath, publicKeyPEM, 'utf-8');
      this.logger.log(` Keys saved to ${keysDir}`);

      return { publicKeyPEM, privateKeyPEM };
    } catch (error) {
      this.logger.error('Error loading or generating keys:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra file tồn tại
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Khởi tạo keys và publish public key qua NATS
   */
  private async initializeAndPublishKeys(): Promise<void> {
    try {
      const { publicKeyPEM } = await this.loadOrGenerateKeys();
      this.publicKey = publicKeyPEM;

      // Publish public key qua NATS
      this.publishPublicKey(publicKeyPEM);
    } catch (error) {
      this.logger.error('Failed to initialize and publish keys:', error);
      throw error;
    }
  }

  /**
   * Publish public key qua NATS subject: auth.public-key
   * Payload: { publicKey, algorithm, issuedAt }
   */
  private publishPublicKey(publicKeyPEM: string): void {
    try {
      const payload = {
        publicKey: publicKeyPEM,
        algorithm: 'RS256',
        issuedAt: new Date().toISOString(),
      };

      this.logger.log('Publishing public key to NATS...');

      // Publish pattern
      this.client.emit('auth.public-key', payload);

      this.logger.log(' Public key published to NATS (subject: auth.public-key)');
    } catch (error) {
      this.logger.error('Failed to publish public key:', error);
      throw error;
    }
  }

  /**
   * Getter: Lấy public key (nếu cần)
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
