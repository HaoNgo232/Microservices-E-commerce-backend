import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { LoginDto, VerifyDto, RefreshDto, RegisterDto } from '@shared/dto/auth.dto';
import { JwtService } from '@shared/main';
import { AuthResponse, UserResponse } from '@shared/types';
import { PrismaService } from '@user-app/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';

/**
 * Interface cho Auth Service
 * Định nghĩa các phương thức authentication
 */
export interface IAuthService {
  /**
   * Đăng nhập với email và password
   */
  login(dto: LoginDto): Promise<AuthResponse>;

  /**
   * Đăng ký tài khoản mới
   */
  register(dto: RegisterDto): Promise<AuthResponse>;

  /**
   * Xác thực JWT token
   */
  verify(dto: VerifyDto): Promise<jose.JWTPayload>;

  /**
   * Làm mới access token
   */
  refresh(dto: RefreshDto): Promise<AuthResponse>;
}

/**
 * AuthService - Service xử lý authentication
 *
 * Xử lý business logic liên quan đến:
 * - Đăng nhập: Validate credentials, generate JWT tokens
 * - Đăng ký: Hash password, tạo user mới, auto-login
 * - Verify token: Validate JWT signature và expiry
 * - Refresh token: Generate new tokens từ refresh token
 *
 * **Security Implementation:**
 * - Password hashing: bcrypt với salt rounds = 10
 * - JWT signing: RSA private key (asymmetric)
 * - JWT verification: RSA public key
 * - Token expiry: accessToken (15m), refreshToken (7d)
 *
 * **JWT Payload Structure:**
 * - sub: userId (JOSE standard claim)
 * - email: user email
 * - role: user role (ADMIN/CUSTOMER)
 * - iat: issued at timestamp
 * - exp: expiration timestamp
 */
@Injectable()
export class AuthService implements IAuthService {
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;

  /**
   * Constructor - Inject dependencies và load JWT config
   *
   * @param jwtService - Service để sign và verify JWT tokens
   * @param prisma - Prisma client để truy cập database
   */
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  /**
   * Đăng nhập với email và password
   *
   * Flow:
   * 1. Validate user credentials (email, password, isActive)
   * 2. Generate JWT tokens (access + refresh)
   * 3. Trả về tokens (user info có trong JWT payload)
   *
   * @param dto - { email, password }
   * @returns JWT tokens
   * @throws RpcException nếu credentials không hợp lệ hoặc user inactive
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    try {
      // Find and validate user
      const user = await this.validateUserCredentials(dto.email, dto.password);

      // Generate tokens (user info đã có trong JWT payload)
      const tokens = await this.generateTokens({
        sub: user.id, // Use 'sub' claim (JOSE standard)
        email: user.email,
        role: user.role,
      });

      // Chỉ trả về tokens - client sẽ decode để lấy user info
      return tokens;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[AuthService] login error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Login failed',
      });
    }
  }

  /**
   * Đăng ký tài khoản mới
   *
   * Flow:
   * 1. Validate email chưa tồn tại
   * 2. Hash password bằng bcrypt
   * 3. Tạo user mới với role CUSTOMER (hardcoded)
   * 4. Auto-login: Generate JWT tokens
   *
   * **Security Note:**
   * - Register chỉ tạo CUSTOMER, không cho phép tự đăng ký ADMIN
   * - ADMIN phải được tạo từ admin panel hoặc script
   *
   * @param dto - { email, password, fullName }
   * @returns JWT tokens
   * @throws RpcException nếu email đã tồn tại hoặc có lỗi tạo user
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    try {
      // Check email có ton tại chưa
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new RpcException({
          statusCode: 400,
          message: 'Email already exists',
        });
      }

      // Hash password với bcrypt (salt rounds = 10)
      const passwordHash = await bcrypt.hash(dto.password, 10);

      // Tạo user mới
      // LƯU Ý: Register luôn tạo CUSTOMER, không cho phép tự đăng ký ADMIN
      const newUser = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          role: 'CUSTOMER', // Hardcoded - ADMIN phải tạo từ admin panel
        },
      });

      // Tự động login sau khi register thành công
      // User info đã có trong JWT payload (sub, email, role)
      const tokens = await this.generateTokens({
        sub: newUser.id, // 'sub' là standard claim trong JWT (subject/user ID)
        email: newUser.email,
        role: newUser.role,
      });

      // Chỉ trả về tokens - client sẽ decode để lấy user info
      return tokens;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[AuthService] register error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to register user',
      });
    }
  }

  /**
   * Xác thực JWT token
   *
   * Flow:
   * 1. Verify token signature và expiry bằng RSA public key
   * 2. Validate payload chứa sub claim (userId)
   * 3. Kiểm tra user vẫn tồn tại và active
   *
   * @param dto - { token }
   * @returns JWT payload nếu hợp lệ
   * @throws RpcException nếu token không hợp lệ, expired, hoặc user inactive
   */
  async verify(dto: VerifyDto): Promise<jose.JWTPayload> {
    try {
      // Use JwtService for RSA-based verification
      const decoded = await this.jwtService.verifyToken(dto.token);

      if (!decoded.sub) {
        throw new RpcException({
          statusCode: 401,
          message: 'Token payload must contain sub claim',
        });
      }

      // Get userId from sub claim (JOSE standard)
      const userId = decoded.sub;

      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new RpcException({
          statusCode: 401,
          message: 'Invalid or expired token',
        });
      }

      return decoded;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[AuthService] verify error:', error);
      throw new RpcException({
        statusCode: 401,
        message: 'Token verification failed',
      });
    }
  }

  /**
   * Làm mới access token bằng refresh token
   *
   * Flow:
   * 1. Verify refresh token (signature + expiry)
   * 2. Extract userId từ sub claim
   * 3. Validate user vẫn tồn tại và active
   * 4. Generate new tokens (cả access và refresh đều mới)
   *
   * @param dto - { refreshToken }
   * @returns JWT tokens mới
   * @throws RpcException nếu refresh token không hợp lệ hoặc user inactive
   */
  async refresh(dto: RefreshDto): Promise<AuthResponse> {
    try {
      // Verify refresh token with JwtService
      const decoded = await this.jwtService.verifyToken(dto.refreshToken);

      if (!decoded.sub) {
        throw new RpcException({
          statusCode: 401,
          message: 'Token payload must contain sub claim',
        });
      }

      // Get userId from sub claim (JOSE standard)
      const userId = decoded.sub;

      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new RpcException({
          statusCode: 401,
          message: 'Invalid refresh token',
        });
      }

      // Generate new tokens (user info đã có trong JWT payload)
      const tokens = await this.generateTokens({
        sub: user.id, // Use 'sub' claim (JOSE standard)
        email: user.email,
        role: user.role,
      });

      return tokens;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[AuthService] refresh error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Token refresh failed',
      });
    }
  }

  /**
   * Generate JWT tokens (access + refresh)
   *
   * Tạo 2 loại token song song để tối ưu performance:
   * - accessToken: thời gian sống ngắn (15m) - dùng cho API calls
   * - refreshToken: thời gian sống dài (7d) - dùng để lấy accessToken mới
   *
   * **QUAN TRỌNG:** Cả 2 đều dùng RSA private key để sign
   *
   * @param payload - JWT payload (sub, email, role)
   * @returns { accessToken, refreshToken }
   * @private
   */
  private async generateTokens(payload: jose.JWTPayload): Promise<{ accessToken: string; refreshToken: string }> {
    const expiresIn = this.parseExpiresIn(this.jwtExpiresIn);
    const refreshExpiresIn = this.parseExpiresIn(this.jwtRefreshExpiresIn);

    // Tạo 2 loại token song song để tối ưu performance:
    // - accessToken: thời gian sống ngắn (15m) - dùng cho API calls
    // - refreshToken: thời gian sống dài (7d) - dùng để lấy accessToken mới
    // QUAN TRỌNG: Cả 2 đều dùng RSA private key để sign
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signToken(payload, expiresIn),
      this.jwtService.signToken(payload, refreshExpiresIn),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Parse JWT expiry string sang seconds
   *
   * Hỗ trợ formats:
   * - 15s: 15 seconds
   * - 15m: 15 minutes
   * - 2h: 2 hours
   * - 7d: 7 days
   *
   * @param expiresIn - Expiry string (e.g., "15m", "7d")
   * @returns Số giây
   * @private
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = new RegExp(/^(\d+)([smhd])$/).exec(expiresIn);
    if (!match) return 900; // default 15 minutes

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] || 60);
  }

  /**
   * Validate user credentials (email & password)
   *
   * @param email - Email của user
   * @param password - Password chưa hash
   * @returns User info nếu credentials hợp lệ
   * @throws RpcException nếu credentials không hợp lệ hoặc user inactive
   * @private
   */
  private async validateUserCredentials(
    email: string,
    password: string,
  ): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: string;
  }> {
    // Find user by email
    const user = await this.findUserByEmail(email);

    // Check if user is active
    this.checkUserActive(user);

    // Verify password
    await this.verifyPassword(password, user.passwordHash);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  /**
   * Tìm user theo email
   *
   * @param email - Email cần tìm
   * @returns User với passwordHash (để verify password)
   * @throws RpcException nếu user không tồn tại
   * @private
   */
  private async findUserByEmail(email: string): Promise<UserResponse & { passwordHash: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new RpcException({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }

    const results = user as UserResponse & { passwordHash: string };

    return results;
  }

  /**
   * Kiểm tra user account có active không
   *
   * @param user - User object với isActive flag
   * @throws RpcException nếu user bị deactivated
   * @private
   */
  private checkUserActive(user: { isActive: boolean }): void {
    if (!user.isActive) {
      throw new RpcException({
        statusCode: 401,
        message: 'Account is deactivated',
      });
    }
  }

  /**
   * Verify password với hash từ database
   *
   * Sử dụng bcrypt.compare để so sánh password với hash
   *
   * @param password - Password chưa hash từ client
   * @param passwordHash - Password hash từ database
   * @throws RpcException nếu password không khớp
   * @private
   */
  private async verifyPassword(password: string, passwordHash: string): Promise<void> {
    const isPasswordValid = await bcrypt.compare(password, passwordHash);

    if (!isPasswordValid) {
      throw new RpcException({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }
  }
}
