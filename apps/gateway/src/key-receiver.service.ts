import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom, timeout } from 'rxjs';

/**
 * KeyReceiverService - Gateway
 *
 * Chức năng:
 * - Subscribe qua NATS subject: auth.public-key
 * - Wait nhận public key message từ user-app
 * - Cache public key trong memory
 * - Expose method để lấy public key
 *
 * Flow:
 * 1. OnModuleInit chạy
 * 2. Subscribe auth.public-key
 * 3. Wait message (timeout 30s, retry 5 lần)
 * 4. Cache public key
 * 5. JwtModule registerAsync sử dụng public key này
 */
@Injectable()
export class KeyReceiverService implements OnModuleInit {
  private readonly logger = new Logger(KeyReceiverService.name);
  private publicKey: string | null = null;
  private keyReceived: Promise<string>;
  private resolveKeyReceived!: (value: string) => void;
  private rejectKeyReceived!: (reason?: any) => void;

  constructor(@Inject('NATS_CLIENT') private client: ClientProxy) {
    // Tạo promise để wait public key
    this.keyReceived = new Promise((resolve, reject) => {
      this.resolveKeyReceived = resolve;
      this.rejectKeyReceived = reject;
    });
  }

  /**
   * Lifecycle hook: Khởi tạo subscription và wait key
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('🔑 KeyReceiverService initializing...');
      await this.subscribeAndWaitForKey();
      this.logger.log(' Public key received and cached');
    } catch (error) {
      this.logger.error(' Failed to receive public key:', error);
      throw error;
    }
  }

  /**
   * Subscribe auth.public-key subject
   * Wait message với timeout và retry logic
   */
  private async subscribeAndWaitForKey(): Promise<void> {
    const maxRetries = 5;
    const timeoutMs = 30000; // 30 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Waiting for public key (attempt ${attempt}/${maxRetries})...`);

        // Subscribe and wait for message
        const message$ = this.client.send('auth.public-key', {});

        // Apply timeout
        const publicKey = await firstValueFrom(message$.pipe(timeout(timeoutMs)), { defaultValue: null });

        if (publicKey && typeof publicKey === 'object' && 'publicKey' in publicKey) {
          const receivedKey = (publicKey as any).publicKey;
          this.publicKey = receivedKey;
          this.resolveKeyReceived(receivedKey);
          return;
        }

        this.logger.warn(`No valid public key received on attempt ${attempt}/${maxRetries}`);

        if (attempt < maxRetries) {
          await this.sleep(2000); // Wait 2s before retry
        }
      } catch (error) {
        this.logger.warn(`Attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : error);

        if (attempt === maxRetries) {
          throw new Error(`Failed to receive public key after ${maxRetries} attempts: ${error}`);
        }

        await this.sleep(2000); // Wait 2s before retry
      }
    }
  }

  /**
   * Subscribe to auth.public-key updates
   * Sử dụng để update public key nếu có key rotation
   */
  private subscribeToKeyUpdates(): void {
    try {
      this.client.subscribe('auth.public-key').subscribe(
        (message: any) => {
          if (message && message.publicKey) {
            this.logger.log('📝 Public key update received');
            this.publicKey = message.publicKey;
            this.logger.log(' Public key updated in cache');
          }
        },
        error => {
          this.logger.error('Error subscribing to key updates:', error);
        },
      );
    } catch (error) {
      this.logger.error('Failed to subscribe to key updates:', error);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cached public key
   * Throws error nếu chưa nhận được key
   */
  async getPublicKey(): Promise<string> {
    if (this.publicKey) {
      return this.publicKey;
    }

    // Wait for key to arrive
    return this.keyReceived;
  }

  /**
   * Check if public key is available
   */
  isKeyAvailable(): boolean {
    return this.publicKey !== null;
  }

  /**
   * Get cached public key synchronously (unsafe, use with caution)
   */
  getPublicKeySync(): string {
    if (!this.publicKey) {
      throw new Error('Public key not yet received from user-app');
    }
    return this.publicKey;
  }
}
