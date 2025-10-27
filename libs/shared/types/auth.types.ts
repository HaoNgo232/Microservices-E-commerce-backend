/**
 * Authentication Response Types
 * Định nghĩa các response types cho authentication endpoints
 */

/**
 * Auth response - chỉ trả về tokens
 * Client sẽ decode accessToken để lấy thông tin user
 */
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Token refresh response
 */
export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Token verification response
 */
export type VerifyResponse = {
  valid: boolean;
  userId?: string;
  email?: string;
  role?: string;
};

/**
 * Token payload structure (for internal use)
 */
export type TokenPayload = {
  sub: string; // userId
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  iss?: string;
};
