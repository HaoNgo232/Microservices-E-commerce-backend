/**
 * Order Response Types
 * Định nghĩa các response types cho order endpoints
 * Based on Order và OrderItem models trong order-app Prisma schema
 */

import { PaymentStatus } from '@shared/types/payment.types';

/**
 * Order item trong order response
 */
export type OrderItemResponse = {
  id: string;
  orderId: string;
  productId: string;
  productName: string; // Product name snapshot at order time
  imageUrls: string[]; // Product image URLs snapshot
  quantity: number;
  priceInt: number; // Giá tại thời điểm đặt hàng (cents) - match Prisma field name
  createdAt: Date;
};

/**
 * Order response với full details
 */
export type OrderResponse = {
  id: string;
  userId: string;
  addressId: string | null; // Match Prisma field name
  status: OrderStatus; // PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED
  paymentStatus: PaymentStatus;
  totalInt: number; // Tổng tiền (cents)
  items: OrderItemResponse[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Paginated orders response
 */
export type PaginatedOrdersResponse = {
  orders: OrderResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}
