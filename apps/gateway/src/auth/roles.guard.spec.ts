import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '@shared/dto/user.dto';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('canActivate', () => {
    let mockContext: Partial<ExecutionContext>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        user: null,
      };

      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      };
    });

    it('should allow access when no @Roles() decorator is present', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(guard.canActivate(mockContext as ExecutionContext)).toBe(true);
    });

    it('should allow access when requiredRoles is empty array', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

      expect(guard.canActivate(mockContext as ExecutionContext)).toBe(true);
    });

    it('should throw ForbiddenException when user is not in request', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
        'User role not found in token',
      );
    });

    it('should throw ForbiddenException when user role is missing', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      mockRequest.user = {}; // user without role

      expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
        'User role not found in token',
      );
    });

    it('should allow access when user role matches required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      mockRequest.user = { role: UserRole.ADMIN };

      expect(guard.canActivate(mockContext as ExecutionContext)).toBe(true);
    });

    it('should allow access when user role is in required roles list', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN, UserRole.CUSTOMER]);

      mockRequest.user = { role: UserRole.CUSTOMER };

      expect(guard.canActivate(mockContext as ExecutionContext)).toBe(true);
    });

    it('should throw ForbiddenException when user role does not match', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      mockRequest.user = { role: UserRole.CUSTOMER };

      expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
        'Access denied. Required roles: ADMIN. Your role: CUSTOMER',
      );
    });

    it('should include multiple required roles in error message', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN, UserRole.CUSTOMER]);

      mockRequest.user = { role: 'INVALID' };

      expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
        'Access denied. Required roles: ADMIN, CUSTOMER. Your role: INVALID',
      );
    });
  });
});
