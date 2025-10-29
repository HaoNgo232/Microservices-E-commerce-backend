/**
 * Order Response Types
 * Định nghĩa các response types cho order endpoints
 * Based on Order và OrderItem models trong order-app Prisma schema
 */

/**
 * Order item trong order response
 */
export type OrderItemResponse = {
  id: string;
  orderId: string;
  productId: string;
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

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
