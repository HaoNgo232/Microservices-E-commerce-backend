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
