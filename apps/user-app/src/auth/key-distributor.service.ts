import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as jose from 'jose';

/**
 * KeyDistributorService - User-app
 *
 * Load hoặc tạo cặp RSA và trả public key khi `gateway` hỏi.
 * Public key được cung cấp qua pattern request-reply trên `auth.public-key`.
 */
@Injectable()
export class KeyDistributorService implements OnModuleInit {
  private readonly logger = new Logger(KeyDistributorService.name);
  private publicKey: string = '';

  constructor(@Inject('NATS_CLIENT') private readonly client: ClientProxy) {}

  /**
   * Lifecycle hook: khởi tạo key và sẵn sàng phục vụ public key
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
   * Tạo thư mục `keys/` nếu chưa có
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
   * Tạo cặp RSA mới (RS256)
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
   * Tải keys từ disk nếu có, còn không thì tạo mới và lưu.
   */
  private async loadOrGenerateKeys(): Promise<{ publicKeyPEM: string; privateKeyPEM: string }> {
    const keysDir = await this.ensureKeysDirectory();
    const privateKeyPath = path.join(keysDir, 'private-key.pem');
    const publicKeyPath = path.join(keysDir, 'public-key.pem');

    try {
      // Kiểm tra keys đã tồn tại
      const privateKeyExists = await this.fileExists(privateKeyPath);
      const publicKeyExists = await this.fileExists(publicKeyPath);

      if (privateKeyExists && publicKeyExists) {
        this.logger.log('Loading existing RSA keys from disk...');
        const privateKeyPEM = await fs.readFile(privateKeyPath, 'utf-8');
        const publicKeyPEM = await fs.readFile(publicKeyPath, 'utf-8');
        this.logger.log(' RSA keys loaded from disk');
        return { publicKeyPEM, privateKeyPEM };
      }

      // Tạo keys mới nếu không có
      const { publicKeyPEM, privateKeyPEM } = await this.generateKeyPair();

      // Lưu keys lên disk
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
   * Kiểm tra file có tồn tại hay không
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
   * Khởi tạo keys và sẵn sàng trả public key cho controller
   */
  private async initializeAndPublishKeys(): Promise<void> {
    try {
      const { publicKeyPEM } = await this.loadOrGenerateKeys();
      this.publicKey = publicKeyPEM;
      this.logger.log(' RSA keys initialized, waiting for Gateway requests on auth.public-key');
    } catch (error) {
      this.logger.error('Failed to initialize keys:', error);
      throw error;
    }
  }

  /**
   * Trả public key khi controller nhận request từ Gateway.
   * Trả về object gồm publicKey, algorithm và issuedAt.
   */
  public handlePublicKeyRequest(): { publicKey: string; algorithm: string; issuedAt: string } {
    return {
      publicKey: this.publicKey,
      algorithm: 'RS256',
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * Trả public key hiện có
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
