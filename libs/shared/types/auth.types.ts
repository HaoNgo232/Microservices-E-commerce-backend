/**
 * Authentication Response Types
 * Định nghĩa các response types cho authentication endpoints
 */

/**
 * User role enum
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

/**
 * User response type based on User model trong user-app
 */
export type User = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

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
