import { UserRole } from '@shared/dto';

/**
 * User Response Types
 * Based on User model trong user-app Prisma schema
 */
export type UserResponse = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole; // CUSTOMER, ADMIN
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ListUsersResponse = {
  users: UserResponse[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Internal User type (bao gồm passwordHash)
 * CHỈ dùng trong user-service, KHÔNG được expose qua API
 */
export type User = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
} | null;
