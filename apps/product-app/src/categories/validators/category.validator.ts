import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '@product-app/prisma/prisma.service';

/**
 * Validator class for category business rules
 * Centralizes validation logic and reduces service complexity
 */
@Injectable()
export class CategoryValidator {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate slug uniqueness
   * @throws RpcException if slug already exists
   */
  async validateSlugUnique(slug: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new RpcException({
        statusCode: 409,
        message: `Category with slug '${slug}' already exists`,
      });
    }
  }

  /**
   * Validate slug uniqueness when updating (allow same slug)
   * @throws RpcException if slug already exists for different category
   */
  async validateSlugForUpdate(newSlug: string | undefined, currentSlug: string): Promise<void> {
    if (!newSlug || newSlug === currentSlug) {
      return;
    }

    const slugExists = await this.prisma.category.findUnique({
      where: { slug: newSlug },
    });

    if (slugExists) {
      throw new RpcException({
        statusCode: 409,
        message: `Category with slug '${newSlug}' already exists`,
      });
    }
  }

  /**
   * Validate parent category exists
   * @throws RpcException if parent not found
   */
  async validateParentExists(parentId: string): Promise<void> {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new RpcException({
        statusCode: 400,
        message: `Parent category with ID ${parentId} not found`,
      });
    }
  }

  /**
   * Validate parent update - check for self-reference and circular references
   * @throws RpcException if parent validation fails
   */
  async validateParentUpdate(categoryId: string, newParentId: string | undefined): Promise<void> {
    if (newParentId === undefined) {
      return;
    }

    if (newParentId === categoryId) {
      throw new RpcException({
        statusCode: 400,
        message: 'Category cannot be its own parent',
      });
    }

    if (!newParentId) {
      return;
    }

    await this.validateParentExists(newParentId);

    const hasCircularReference = await this.checkCircularReference(newParentId, categoryId);
    if (hasCircularReference) {
      throw new RpcException({
        statusCode: 400,
        message: 'Cannot create circular reference: the new parent is a descendant of this category',
      });
    }
  }

  /**
   * Check for circular reference in category hierarchy
   * Recursively traverses up the parent chain
   * @param potentialParentId The ID of the category that will become the parent
   * @param categoryId The ID of the category being updated
   * @returns Promise<boolean> true if circular reference detected
   * @private
   */
  private async checkCircularReference(potentialParentId: string, categoryId: string): Promise<boolean> {
    let currentId: string | null = potentialParentId;
    const visitedIds = new Set<string>([categoryId]);

    while (currentId) {
      if (visitedIds.has(currentId)) {
        return true; // Circular reference detected
      }

      visitedIds.add(currentId);

      const current: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      if (!current) {
        break;
      }

      const parentId: string | null = current.parentId;
      currentId = parentId;
    }

    return false;
  }

  /**
   * Validate category can be deleted (no children, no products)
   * @throws RpcException if category has children or products
   */
  async validateCanDelete(categoryId: string): Promise<{ childrenCount: number; productCount: number }> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: {
          select: { id: true },
        },
        products: {
          select: { id: true },
        },
      },
    });

    if (!category) {
      return { childrenCount: 0, productCount: 0 };
    }

    if (category.children.length > 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Cannot delete category with child categories. Delete or reassign children first.',
      });
    }

    if (category.products.length > 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Cannot delete category with products. Reassign products first.',
      });
    }

    return {
      childrenCount: category.children.length,
      productCount: category.products.length,
    };
  }
}
