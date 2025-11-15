import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@shared/dto/user.dto';

/**
 * Metadata key để lưu roles trong Reflector
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator để chỉ định roles được phép truy cập endpoint
 *
 * Sử dụng cùng với @UseGuards(AuthGuard, RolesGuard)
 *
 * @param roles - Danh sách roles được phép (OR logic - chỉ cần 1 role match)
 *
 * @example Ví dụ: Endpoint chỉ dành cho Admin
 * ```typescript
 * @Get('users')
 * @UseGuards(AuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN)
 * async listAllUsers() { ... }
 * ```
 *
 * @example Ví dụ: Cho phép nhiều vai trò
 * ```typescript
 * @Get('products')
 * @UseGuards(AuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
 * async listProducts() { ... }
 * ```
 *
 * @example Ví dụ: Không có @Roles() (chỉ cần xác thực)
 * ```typescript
 * @Get('me')
 * @UseGuards(AuthGuard, RolesGuard)
 * async getMyProfile() { ... }
 * ```
 */
export const Roles = (...roles: UserRole[]): MethodDecorator => SetMetadata(ROLES_KEY, roles);
