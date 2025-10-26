import { ROLES_KEY, Roles } from './roles.decorator';
import { UserRole } from '@shared/dto/user.dto';

describe('@Roles() Decorator', () => {
  describe('Metadata handling', () => {
    it('should set metadata with single role on method', (): void => {
      class TestController {
        @Roles(UserRole.ADMIN)
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.testMethod);

      expect(metadata).toEqual([UserRole.ADMIN]);
    });

    it('should set metadata with multiple roles on method', (): void => {
      class TestController {
        @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.testMethod);

      expect(metadata).toEqual([UserRole.ADMIN, UserRole.CUSTOMER]);
    });

    it('should work with only one role provided', (): void => {
      class TestController {
        @Roles(UserRole.CUSTOMER)
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.testMethod);

      expect(metadata).toEqual([UserRole.CUSTOMER]);
    });

    it('should handle empty roles array', (): void => {
      class TestController {
        @Roles()
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.testMethod);

      expect(metadata).toEqual([]);
    });
  });

  describe('Decorator function', () => {
    it('should be callable with spread operator', (): void => {
      const roles = [UserRole.ADMIN, UserRole.CUSTOMER];

      class TestController {
        @Roles(...roles)
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.testMethod);

      expect(metadata).toEqual([UserRole.ADMIN, UserRole.CUSTOMER]);
    });

    it('should return a MethodDecorator type', (): void => {
      const decorator = Roles(UserRole.ADMIN);

      expect(typeof decorator).toBe('function');
    });
  });

  describe('Integration with Reflector', () => {
    it('should store metadata that Reflector can retrieve', (): void => {
      class TestController {
        @Roles(UserRole.ADMIN)
        adminMethod(): void {}

        @Roles(UserRole.CUSTOMER)
        customerMethod(): void {}

        @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
        bothMethod(): void {}
      }

      const adminMetadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.adminMethod);
      const customerMetadata = Reflect.getMetadata(
        ROLES_KEY,
        TestController.prototype.customerMethod,
      );
      const bothMetadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.bothMethod);

      expect(adminMetadata).toEqual([UserRole.ADMIN]);
      expect(customerMetadata).toEqual([UserRole.CUSTOMER]);
      expect(bothMetadata).toEqual([UserRole.ADMIN, UserRole.CUSTOMER]);
    });
  });
});
