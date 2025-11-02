/**
 * Product Response Types
 * Based on Product và Category models trong product-app Prisma schema
 */

import type { CategoryResponse, CategoryWithRelations } from './category.types';

// Product response types for API responses
export type ProductResponse = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  priceInt: number; // Price in cents (e.g., 1999 = $19.99)
  stock: number;
  description: string | null;
  imageUrls: string[];
  categoryId: string | null;
  attributes: Record<string, unknown> | null; // Json field trong Prisma
  model3dUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  category?: CategoryResponse | null; // Populated từ relation
};

// Paginated list response for products
export type PaginatedProductsResponse = {
  products: ProductResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// Product with category details
export type ProductWithCategory = ProductResponse & {
  category: CategoryResponse | null;
};

// Stock change result
export type StockChangeResult = {
  productId: string;
  previousStock: number;
  newStock: number;
  quantityChanged: number;
};

// Re-export category types for convenience
export type { CategoryResponse, CategoryWithRelations } from './category.types';
export type { PaginatedCategoriesResponse } from './category.types';
