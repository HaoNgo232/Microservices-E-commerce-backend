/**
 * Product Response Types
 * Based on Product và Category models trong product-app Prisma schema
 */

import type { CategoryResponse } from './category.types';

// Product attributes structure
export interface ProductAttributes {
  // Core attributes
  brand: string;
  frameShape: string; // e.g., "Aviator", "Wayfarer", "Round", "Square"
  frameMaterial: string; // e.g., "Metal", "Acetate", "TR90"
  color: string;

  // Optional attributes
  lensMaterial?: string; // e.g., "Polycarbonate", "Glass"
  uvProtection?: string; // e.g., "UV400"
  gender?: 'Nam' | 'Nữ' | 'Unisex';
  age?: string; // e.g., "5-12" for kids
  style?: string; // e.g., "Vintage", "Modern"
  weight?: string; // e.g., "Ultra Light"
  type?: string; // For accessories: "Hard Case", "Chain/Strap"
  strength?: string; // For reading glasses: "+2.0"

  // Boolean features
  polarized?: boolean;
  prizm?: boolean;
  blueLight?: boolean;
  photochromic?: boolean;
  mirrored?: boolean;
  foldable?: boolean;
  multifocal?: boolean;
  eco?: boolean;

  // Try-on specific attributes (optional)
  tryOnImageUrl?: string;
  tryOnKey?: string;

  // Allow future expansion
  [key: string]: unknown;
}

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
  attributes: ProductAttributes | null; // Json field trong Prisma
  model3dUrl: string | null;
  tryOnImageUrl?: string; // Optional: extracted from attributes.tryOnImageUrl
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
