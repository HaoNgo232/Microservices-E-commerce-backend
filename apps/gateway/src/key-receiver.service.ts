import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

interface PublicKeyMessage {
  publicKey: string;
  algorithm: string;
  issuedAt: string;
}

/**
 * KeyReceiverService - Gateway
 *
 * Nhận public key từ `user-app` qua NATS bằng request-reply (send/sendReply).
 * Lưu key vào bộ nhớ và cung cấp các phương thức để lấy key.
 * Khi khởi động, service sẽ cố lấy key (timeout + retry).
 */
@Injectable()
export class KeyReceiverService implements OnModuleInit {
  private readonly logger = new Logger(KeyReceiverService.name);
  private publicKey: string | null = null;
  private readonly keyReceived: Promise<string>;
  private resolveKeyReceived!: (value: string) => void;
  private rejectKeyReceived!: (reason?: Error | string) => void;

  constructor(@Inject('NATS_CLIENT') private readonly client: ClientProxy) {
    // Tạo Promise để chờ public key
    this.keyReceived = new Promise((resolve, reject) => {
      this.resolveKeyReceived = resolve;
      this.rejectKeyReceived = reject;
    });
  }

  /**
   * Lifecycle hook: khởi tạo và chờ public key
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log(' KeyReceiverService initializing...');
      await this.subscribeAndWaitForKey();
      this.logger.log(' Public key received and cached');
    } catch (error) {
      this.logger.error(' Failed to receive public key:', error);
      throw error;
    }
  }

  /**
   * Gửi request đến `auth.public-key` và chờ reply.
   * Có timeout và retry để đảm bảo khởi động ổn định.
   */
  private async subscribeAndWaitForKey(): Promise<void> {
    const maxRetries = 5;
    const timeoutMs = 30000; // 30 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Waiting for public key (attempt ${attempt}/${maxRetries})...`);

        // Gửi request và chờ reply
        const message$ = this.client.send<PublicKeyMessage>('auth.public-key', {});

        // Áp timeout
        const publicKey = await firstValueFrom(message$.pipe(timeout(timeoutMs)), {
          defaultValue: null as PublicKeyMessage | null,
        });

        if (publicKey && typeof publicKey === 'object' && 'publicKey' in publicKey) {
          this.publicKey = publicKey.publicKey;
          this.resolveKeyReceived(publicKey.publicKey);
          return;
        }

        this.logger.warn(`Không nhận được public key hợp lệ (lần ${attempt}/${maxRetries})`);

        if (attempt < maxRetries) {
          await this.sleep(2000); // Chờ 2s trước khi thử lại
        }
      } catch (error) {
        this.logger.warn(`Lần thử ${attempt}/${maxRetries} thất bại:`, error instanceof Error ? error.message : error);

        if (attempt === maxRetries) {
          throw new Error(`Không nhận được public key sau ${maxRetries} lần thử: ${error}`);
        }

        await this.sleep(2000); // Wait 2s before retry
      }
    }
  }

  /**
   * Lưu ý: Có thể thêm hỗ trợ luân chuyển key (key rotation) sau này.
   * Hiện tại service chỉ lấy key 1 lần khi khởi động và cache lại.
   */

  /**
   * Sleep utility (dùng để delay giữa các retry)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Trả về public key đã cache. Nếu chưa có, chờ Promise `keyReceived`.
   */
  async getPublicKey(): Promise<string> {
    if (this.publicKey) {
      return this.publicKey;
    }

    // Wait for key to arrive
    return this.keyReceived;
  }

  /**
   * Kiểm tra xem public key đã được load chưa
   */
  isKeyAvailable(): boolean {
    return this.publicKey !== null;
  }

  /**
   * Trả public key đồng bộ (unsafe) — chỉ dùng khi chắc chắn key đã sẵn sàng
   */
  getPublicKeySync(): string {
    if (!this.publicKey) {
      throw new Error('Public key not yet received from user-app');
    }
    return this.publicKey;
  }
}
