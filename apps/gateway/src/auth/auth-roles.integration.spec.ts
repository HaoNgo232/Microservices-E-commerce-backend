import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@shared/main';
import { UserRole } from '@shared/dto/user.dto';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

describe('AuthGuard + RolesGuard Integration', () => {
  let authGuard: AuthGuard;
  let rolesGuard: RolesGuard;
  let jwtService: jest.Mocked<JwtService>;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jwtService = {
      verifyToken: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    authGuard = new AuthGuard(jwtService);
    rolesGuard = new RolesGuard(reflector);
  });

  describe('Authentication Tests (AuthGuard)', () => {
    it('should return 401 when no token provided', async () => {
      const context = createMockContext({ headers: {} });

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.verifyToken).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      jwtService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const context = createMockContext({
        headers: { authorization: 'Bearer invalid_token' },
      });

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.verifyToken).toHaveBeenCalledWith('invalid_token');
    });

    it('should return 401 when authorization header format is wrong', async () => {
      const context = createMockContext({
        headers: { authorization: 'InvalidFormat token' },
      });

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.verifyToken).not.toHaveBeenCalled();
    });

    it('should attach user to request when token is valid', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN',
      };

      jwtService.verifyToken.mockResolvedValue(mockPayload);

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);

      await expect(authGuard.canActivate(context)).resolves.toBe(true);
      expect(request['user']).toEqual({
        userId: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN',
      });
    });
  });

  describe('Authorization Tests (RolesGuard)', () => {
    beforeEach(() => {
      // Giả lập việc xác thực JWT thành công cho tất cả tests
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN',
      });
    });

    it('should allow ADMIN to access ADMIN-only endpoint', async () => {
      // Setup: AuthGuard attaches user
      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard checks ADMIN role
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should deny CUSTOMER access to ADMIN-only endpoint', async () => {
      // Setup: AuthGuard attaches CUSTOMER user
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-456',
        email: 'customer@test.com',
        role: 'CUSTOMER',
      });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard checks ADMIN role
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow CUSTOMER to access CUSTOMER-only endpoint', async () => {
      // Setup: AuthGuard attaches CUSTOMER user
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-456',
        email: 'customer@test.com',
        role: 'CUSTOMER',
      });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard checks CUSTOMER role
      reflector.getAllAndOverride.mockReturnValue([UserRole.CUSTOMER]);

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should deny ADMIN access to CUSTOMER-only endpoint', async () => {
      // Setup: AuthGuard attaches ADMIN user
      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard checks CUSTOMER role
      reflector.getAllAndOverride.mockReturnValue([UserRole.CUSTOMER]);

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow both ADMIN and CUSTOMER to access both-roles endpoint', async () => {
      // Test with ADMIN
      const adminRequest = { headers: { authorization: 'Bearer valid_token' } };
      const adminContext = createMockContext(adminRequest);
      await authGuard.canActivate(adminContext);

      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.CUSTOMER]);
      expect(rolesGuard.canActivate(adminContext)).toBe(true);

      // Test with CUSTOMER
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-456',
        email: 'customer@test.com',
        role: 'CUSTOMER',
      });

      const customerRequest = { headers: { authorization: 'Bearer valid_token' } };
      const customerContext = createMockContext(customerRequest);
      await authGuard.canActivate(customerContext);

      expect(rolesGuard.canActivate(customerContext)).toBe(true);
    });

    it('should allow any authenticated user to access auth-only endpoint', async () => {
      // Setup: AuthGuard attaches user
      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard with no required roles (auth only)
      reflector.getAllAndOverride.mockReturnValue(undefined);

      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe('Guard Order Tests', () => {
    it('should run AuthGuard before RolesGuard (401 for invalid token, not 403)', async () => {
      // This test ensures AuthGuard runs first and catches invalid tokens
      jwtService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const request = { headers: { authorization: 'Bearer invalid_token' } };
      const context = createMockContext(request);

      // AuthGuard should fail first
      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);

      // RolesGuard should never be called
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
      // This would throw 403, but AuthGuard already failed with 401
    });

    it('should run RolesGuard after AuthGuard (403 for wrong role, not 401)', async () => {
      // Setup: AuthGuard succeeds
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-456',
        email: 'customer@test.com',
        role: 'CUSTOMER',
      });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard fails
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      // Should be 403 (RolesGuard), not 401 (AuthGuard)
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('Error Response Format Tests', () => {
    it('should return 401 with correct error structure for missing token', async () => {
      const context = createMockContext({ headers: {} });

      try {
        await authGuard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toContain('Missing authorization header');
      }
    });

    it('should return 403 with correct error structure for wrong role', async () => {
      // Setup: AuthGuard succeeds
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-456',
        email: 'customer@test.com',
        role: 'CUSTOMER',
      });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard fails
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      try {
        rolesGuard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toContain('Required roles: ADMIN');
        expect(error.message).toContain('Your role: CUSTOMER');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty roles array', async () => {
      // Setup: AuthGuard succeeds
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN',
      });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);
      await authGuard.canActivate(context);

      // Setup: RolesGuard with empty roles array
      reflector.getAllAndOverride.mockReturnValue([]);

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should handle JWT payload with missing role field', async () => {
      // Setup: AuthGuard fails due to missing role
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-123',
        email: 'test@test.com',
        // role: missing
      } as { sub: string; email: string });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);

      // AuthGuard should catch this and throw 401
      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle user missing from request in RolesGuard', () => {
      // Setup: RolesGuard without AuthGuard (user not attached)
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const context = createMockContext({}); // No user attached

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => rolesGuard.canActivate(context)).toThrow('User role not found in token');
    });
  });

  describe('Complete Integration Flow', () => {
    it('should complete full auth + authorization flow successfully', async () => {
      // Step 1: AuthGuard verifies token and attaches user
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN',
      });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);

      // Step 2: AuthGuard succeeds
      await expect(authGuard.canActivate(context)).resolves.toBe(true);
      expect(request['user']).toEqual({
        userId: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN',
      });

      // Step 3: RolesGuard checks authorization
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      // Step 4: RolesGuard succeeds
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should fail at AuthGuard step (invalid token)', async () => {
      // Step 1: AuthGuard fails due to invalid token
      jwtService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const request = { headers: { authorization: 'Bearer invalid_token' } };
      const context = createMockContext(request);

      // Step 2: AuthGuard fails
      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);

      // Step 3: RolesGuard never gets called
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
      expect(jwtService.verifyToken).toHaveBeenCalledWith('invalid_token');
    });

    it('should fail at RolesGuard step (wrong role)', async () => {
      // Step 1: AuthGuard succeeds
      jwtService.verifyToken.mockResolvedValue({
        sub: 'user-456',
        email: 'customer@test.com',
        role: 'CUSTOMER',
      });

      const request = { headers: { authorization: 'Bearer valid_token' } };
      const context = createMockContext(request);

      // Step 2: AuthGuard succeeds
      await expect(authGuard.canActivate(context)).resolves.toBe(true);

      // Step 3: RolesGuard fails due to wrong role
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      // Step 4: RolesGuard fails
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
