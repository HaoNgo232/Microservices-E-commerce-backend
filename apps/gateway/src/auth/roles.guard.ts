import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@shared/dto/user.dto';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';

/**
 * RolesGuard - Role-based Authorization Guard
 *
 * Kiểm tra xem user có role phù hợp để truy cập endpoint không.
 * Chỉ hoạt động khi có @Roles() decorator, nếu không thì chỉ cần authentication.
 *
 * Execution Order:
 * 1. AuthGuard runs first → Verify JWT, attach user to request
 * 2. RolesGuard runs second → Check if user.role matches @Roles() requirement
 *
 * @example
 * ```typescript
 * @Get('users')
 * @UseGuards(AuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN)
 * async listAllUsers() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy roles yêu cầu từ decorator @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Nếu không có @Roles() decorator → cho phép truy cập (chỉ cần authentication)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 3. Lấy user từ request (đã được AuthGuard attach vào)
    const request = context.switchToHttp().getRequest<Request & { user?: { role: UserRole } }>();
    const user = request.user;

    // 4. Kiểm tra user có role phù hợp không
    if (!user || !user.role) {
      throw new ForbiddenException('User role not found in token');
    }

    // 5. Check if user's role matches any required roles
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${user.role}`,
      );
    }

    return true;
  }
}
