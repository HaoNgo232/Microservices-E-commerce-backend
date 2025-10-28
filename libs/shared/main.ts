/**
 * Điểm xuất (entrypoint) của thư viện dùng chung
 * Gom và re-export cấu hình, DTOs, types, filters, utils, JWT, exceptions, helpers, events
 */
export * from './config/index';
export * from './dto/index';
export * from './types/index';
export * from './filters/index';
export * from './utils/index';

// JWT module & service
export * from './jwt/jwt.service';
export * from './jwt/jwt.module';

// RPC Exceptions
export * from './exceptions/rpc-exceptions';

// Test helpers (chỉ import trong test)
export * from './testing/rpc-test-helpers';

// NATS event patterns
export * from './events';
