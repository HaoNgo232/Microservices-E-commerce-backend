/**
 * AR (Augmented Reality) Response Types
 * Định nghĩa các response types cho AR endpoints
 * Based on ARSnapshot model trong ar-app Prisma schema
 */

/**
 * AR Snapshot response
 */
export type ARSnapshotResponse = {
  id: string;
  userId: string | null;
  productId: string;
  imageUrl: string; // URL của ảnh snapshot (user chụp với AR)
  metadata?: Record<string, unknown> | null; // Metadata như camera position, lighting, etc.
  createdAt: Date;
};

/**
 * Paginated AR snapshots response
 */
export type PaginatedARSnapshotsResponse = {
  snapshots: ARSnapshotResponse[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * AR snapshot creation result
 */
export type ARSnapshotCreateResponse = {
  id: string;
  imageUrl: string;
  createdAt: Date;
};

/**
 * Sales summary report response
 */
export type SalesSummaryResponse = {
  fromAt: Date;
  toAt: Date;
  totalOrders: number;
  totalRevenueInt: number;
  averageOrderValueInt: number;
};

/**
 * Product performance report response
 */
export type ProductPerformanceResponse = {
  fromAt: Date;
  toAt: Date;
  products: Array<{
    productId: string;
    productName: string;
    totalQuantitySold: number;
    totalRevenueInt: number;
  }>;
};

/**
 * User cohort report response
 */
export type UserCohortResponse = {
  fromAt: Date;
  toAt: Date;
  newUsers: number;
  activeUsers: number;
  returningCustomers: number;
};
