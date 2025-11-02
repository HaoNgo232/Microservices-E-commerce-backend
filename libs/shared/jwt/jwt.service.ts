import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import * as jose from 'jose';
import * as path from 'node:path';
import { FileReaderService } from '../utils/file-reader.service';

/**
 * JwtService - Ký và xác thực JWT dựa trên RSA (bất đối xứng)
 *
 * Chức năng:
 * - user-app: có private key để ký token
 * - các service khác: có public key để verify token
 *
 * Key được nạp từ thư mục keys/ dưới dạng PEM.
 *
 * Ví dụ ký (ở user-app):
 * const token = await jwtService.signToken({ sub, email, role }, 900);
 *
 * Ví dụ verify (ở các service khác):
 * const payload = await jwtService.verifyToken(token);
 */
@Injectable()
export class JwtService implements OnModuleInit {
  private privateKey: jose.KeyLike | null = null;
  private publicKey: jose.KeyLike | null = null;

  private readonly algorithm = 'RS256';
  private readonly issuer = 'luan-van-ecommerce';

  constructor(private readonly fileReader: FileReaderService) {}

  /**
   * Lifecycle hook: Tự động nạp key khi module khởi tạo
   */
  async onModuleInit(): Promise<void> {
    await this.loadKeys();
  }

  /**
   * Nạp RSA keys từ thư mục keys/ (định dạng PEM)
   *
   * Yêu cầu:
   * - keys/public-key.pem: bắt buộc (mọi service đều cần để verify)
   * - keys/private-key.pem: tuỳ chọn (chỉ cần ở service ký token)
   *
   * @throws Error nếu thiếu public key hoặc không thể import key
   */
  private async loadKeys(): Promise<void> {
    try {
      const keysDir = path.join(process.cwd(), 'keys');

      // Public key: bắt buộc
      const publicKeyPath = path.join(keysDir, 'public-key.pem');
      const publicKeyPEM = await this.fileReader.readFile(publicKeyPath);
      this.publicKey = await jose.importSPKI(publicKeyPEM, this.algorithm);

      console.log('[JwtService] ✅ Public key loaded successfully from file');

      // Private key: tuỳ chọn (ở user-app)
      const privateKeyPath = path.join(keysDir, 'private-key.pem');
      const privateKeyExists = await this.fileReader.fileExists(privateKeyPath);

      if (privateKeyExists) {
        const privateKeyPEM = await this.fileReader.readFile(privateKeyPath);
        this.privateKey = await jose.importPKCS8(privateKeyPEM, this.algorithm);
        console.log('[JwtService] ✅ Private key loaded successfully (signing enabled)');
      } else {
        console.log('[JwtService] ℹ️  Private key not found (verification-only mode)');
      }
    } catch (error) {
      console.error('[JwtService] ❌ Failed to load RSA keys:', error);
      throw new Error(`JWT key initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ký JWT bằng private key (thuật toán RS256)
   *
   * Chỉ nên gọi ở service có private key (ví dụ user-app).
   *
   * @param payload Dữ liệu JWT (bắt buộc có sub)
   * @param expiresInSeconds Thời hạn (giây)
   * @returns Chuỗi JWT đã ký
   * @throws UnauthorizedException nếu chưa nạp private key hoặc payload thiếu sub
   */
  async signToken(payload: jose.JWTPayload, expiresInSeconds: number): Promise<string> {
    if (!this.privateKey) {
      throw new UnauthorizedException(
        '[JwtService] Cannot sign token: Private key not loaded (ensure keys/private-key.pem exists in user-app)',
      );
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token payload must contain sub claim');
    }

    try {
      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: this.algorithm })
        .setIssuedAt()
        .setIssuer(this.issuer)
        .setExpirationTime(`${expiresInSeconds}s`)
        .setSubject(payload.sub)
        .sign(this.privateKey);

      return token;
    } catch (error) {
      console.error('[JwtService] Error signing token:', error);
      throw new UnauthorizedException(
        `Failed to sign JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Xác thực JWT bằng public key (RS256)
   *
   * - Hợp lệ: trả về payload đã verify (đúng chữ ký, chưa hết hạn, đúng issuer)
   * - Không hợp lệ: ném UnauthorizedException với thông điệp phù hợp
   *
   * @param token JWT cần verify
   * @returns Payload đã xác thực
   */
  async verifyToken(token: string): Promise<jose.JWTPayload> {
    if (!this.publicKey) {
      throw new UnauthorizedException(
        '[JwtService] Cannot verify token: Public key not loaded (ensure keys/public-key.pem exists)',
      );
    }

    try {
      const { payload } = await jose.jwtVerify(token, this.publicKey, {
        issuer: this.issuer,
      });

      return payload;
    } catch (error) {
      // Phân loại một số lỗi jose phổ biến
      if (error instanceof jose.errors.JWTExpired) {
        throw new UnauthorizedException('Token has expired');
      }

      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        throw new UnauthorizedException(`Token validation failed: ${error.claim} claim invalid`);
      }

      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        throw new UnauthorizedException('Token signature verification failed');
      }

      if (error instanceof jose.errors.JWSInvalid) {
        throw new UnauthorizedException('Token format is invalid');
      }

      console.error('[JwtService] Token verification error:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Giải mã JWT KHÔNG kèm xác thực (chỉ phục vụ debug/log)
   *
   * Cảnh báo: Không kiểm tra chữ ký/expiry!
   *
   * @param token JWT cần decode
   * @returns payload và header đã giải mã
   */
  decodeToken(token: string): { payload: jose.JWTPayload; header: jose.JWSHeaderParameters } {
    try {
      const payload = jose.decodeJwt(token);
      const header = jose.decodeProtectedHeader(token);

      return {
        payload,
        header,
      };
    } catch (error) {
      console.error('[JwtService] Token decode error:', error);
      throw new UnauthorizedException('Invalid token format');
    }
  }

  /**
   * Kiểm tra khả năng ký token (đã nạp private key hay chưa)
   */
  canSignTokens(): boolean {
    return this.privateKey !== null;
  }

  /**
   * Kiểm tra khả năng verify token (đã nạp public key hay chưa)
   */
  canVerifyTokens(): boolean {
    return this.publicKey !== null;
  }
}
