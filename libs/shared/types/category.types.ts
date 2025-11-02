/**
 * Category Response Types
 * Based on Category model trong product-app Prisma schema
 */

/**
 * Category response type for API responses
 */
export type CategoryResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  parent?: CategoryResponse | null;
  children?: CategoryResponse[];
};

/**
 * Paginated list response for categories
 */
export type PaginatedCategoriesResponse = {
  categories: CategoryResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Category with children and products
 */
export type CategoryWithRelations = CategoryResponse & {
  children: CategoryResponse[];
  parent?: CategoryResponse | null;
};
