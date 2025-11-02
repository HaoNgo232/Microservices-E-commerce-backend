import { Injectable } from '@nestjs/common';
import { ProductResponse } from '@shared/types/product.types';

/**
 * Mapper class for converting Prisma product entities to DTOs
 * Reduces boilerplate and centralizes transformation logic
 */
@Injectable()
export class ProductMapper {
  /**
   * Map Prisma product to ProductResponse
   */
  mapToProductResponse(product: {
    id: string;
    sku: string;
    name: string;
    slug: string;
    priceInt: number;
    stock: number;
    description: string | null;
    imageUrls: string[];
    categoryId: string | null;
    attributes: unknown;
    model3dUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    category?: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }): ProductResponse {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      priceInt: product.priceInt,
      stock: product.stock,
      description: product.description,
      imageUrls: product.imageUrls,
      categoryId: product.categoryId,
      attributes: product.attributes as Record<string, unknown> | null,
      model3dUrl: product.model3dUrl,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      category: this.mapCategory(product.category),
    };
  }

  /**
   * Map multiple products to ProductResponse array
   */
  mapManyToProductResponse(products: Parameters<typeof this.mapToProductResponse>[0][]): ProductResponse[] {
    return products.map(p => this.mapToProductResponse(p));
  }

  /**
   * Helper: Map category
   * @private
   */
  private mapCategory(
    category:
      | {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          parentId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | null
      | undefined,
  ): ProductResponse['category'] {
    if (!category) return null;

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
