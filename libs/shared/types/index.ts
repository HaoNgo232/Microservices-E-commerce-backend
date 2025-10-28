/**
 * Chỉ mục (index) cho toàn bộ kiểu dữ liệu (types) dùng chung.
 *
 * Mục đích: Dễ dàng import từ một điểm duy nhất.
 * @example
 * import { UserResponse, ProductResponse, CartResponse } from '@shared/types';
 */

// Authentication types
export * from './auth.types';

// User types
export * from './user.types';

// Product types
export * from './product.types';

// Cart types
export * from './cart.types';

// Order types
export * from './order.types';

// Address types
export * from './address.types';

// Payment types
export * from './payment.types';

// AR types
export * from './ar.types';

// Common response types
export * from './response.types';

// Error types
export * from './error.types';
