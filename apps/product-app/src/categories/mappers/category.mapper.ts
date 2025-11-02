import { Injectable } from '@nestjs/common';
import { CategoryResponse, CategoryWithRelations } from '@shared/types/product.types';

/**
 * Mapper class for converting Prisma category entities to DTOs
 * Reduces boilerplate and centralizes transformation logic
 */
@Injectable()
export class CategoryMapper {
  /**
   * Map Prisma category to CategoryResponse
   */
  mapToCategoryResponse(category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    parent?: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    children?: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): CategoryResponse {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parent: this.mapParent(category.parent),
      children: this.mapChildren(category.children),
    };
  }

  /**
   * Map Prisma category to CategoryWithRelations
   */
  mapToCategoryWithRelations(category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    parent?: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    children?: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): CategoryWithRelations {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parent: this.mapParent(category.parent),
      children: this.mapChildren(category.children) ?? [],
    };
  }

  /**
   * Map multiple categories to CategoryResponse array
   */
  mapManyToCategoryResponse(categories: Parameters<typeof this.mapToCategoryResponse>[0][]): CategoryResponse[] {
    return categories.map(c => this.mapToCategoryResponse(c));
  }

  /**
   * Helper: Map parent category
   * @private
   */
  private mapParent(
    parent:
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
  ): CategoryResponse['parent'] {
    if (!parent) return null;

    return {
      id: parent.id,
      name: parent.name,
      slug: parent.slug,
      description: parent.description,
      parentId: parent.parentId,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
    };
  }

  /**
   * Helper: Map children categories
   * @private
   */
  private mapChildren(
    children:
      | Array<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          parentId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      | undefined,
  ): CategoryResponse['children'] | undefined {
    if (!children) return undefined;

    return children.map(child => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      description: child.description,
      parentId: child.parentId,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    }));
  }
}
