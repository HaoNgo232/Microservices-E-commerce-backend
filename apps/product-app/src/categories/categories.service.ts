import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  CategoryCreateDto,
  CategoryUpdateDto,
  CategoryIdDto,
  CategorySlugDto,
  CategoryListQueryDto,
} from '@shared/dto/category.dto';
import { CategoryResponse, PaginatedCategoriesResponse, CategoryWithRelations } from '@shared/types/product.types';
import { PrismaService } from '@product-app/prisma/prisma.service';
import { CategoryMapper } from './mappers/category.mapper';
import { CategoryValidator } from './validators/category.validator';
import { CategoryQueryBuilder } from './builders/category-query.builder';

export interface ICategoriesService {
  getById(dto: CategoryIdDto): Promise<CategoryWithRelations>;
  getBySlug(dto: CategorySlugDto): Promise<CategoryWithRelations>;
  list(query: CategoryListQueryDto): Promise<PaginatedCategoriesResponse>;
  create(dto: CategoryCreateDto): Promise<CategoryResponse>;
  update(id: string, dto: CategoryUpdateDto): Promise<CategoryResponse>;
  delete(id: string): Promise<{ success: boolean; id: string }>;
}

@Injectable()
export class CategoriesService implements ICategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CategoryMapper,
    private readonly validator: CategoryValidator,
    private readonly queryBuilder: CategoryQueryBuilder,
  ) {}

  /**
   * Get category by ID with relationships
   * @throws RpcException if category not found
   */
  async getById(dto: CategoryIdDto): Promise<CategoryWithRelations> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.id },
        include: {
          parent: true,
          children: true,
        },
      });

      if (!category) {
        throw new RpcException({
          statusCode: 404,
          message: `Category with ID ${dto.id} not found`,
        });
      }

      return this.mapper.mapToCategoryWithRelations(category);
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[CategoriesService] getById error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to retrieve category',
      });
    }
  }

  /**
   * Get category by slug with relationships
   * @throws RpcException if category not found
   */
  async getBySlug(dto: CategorySlugDto): Promise<CategoryWithRelations> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
        include: {
          parent: true,
          children: true,
        },
      });

      if (!category) {
        throw new RpcException({
          statusCode: 404,
          message: `Category with slug '${dto.slug}' not found`,
        });
      }

      return this.mapper.mapToCategoryWithRelations(category);
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[CategoriesService] getBySlug error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to retrieve category',
      });
    }
  }

  /**
   * List categories with pagination and filters
   */
  async list(query: CategoryListQueryDto): Promise<PaginatedCategoriesResponse> {
    try {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const { skip, take } = this.queryBuilder.getPaginationParams(query);

      const where = await this.queryBuilder.buildWhereClause(query);

      // Check if parent was not found
      if (where.id && (where.id as Record<string, unknown>).equals === 'PARENT_NOT_FOUND') {
        return {
          categories: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      // Execute queries in parallel
      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          include: {
            parent: true,
            children: true,
          },
          skip,
          take,
          orderBy: {
            name: 'asc',
          },
        }),
        this.prisma.category.count({ where }),
      ]);

      const { totalPages } = this.queryBuilder.getPaginationMetadata(page, pageSize, total);

      return {
        categories: this.mapper.mapManyToCategoryResponse(categories),
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      console.error('[CategoriesService] list error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to retrieve categories',
      });
    }
  }

  /**
   * Create a new category
   * @throws RpcException if slug already exists
   * @throws RpcException if parent category doesn't exist
   */
  async create(dto: CategoryCreateDto): Promise<CategoryResponse> {
    try {
      // Validate unique slug
      await this.validator.validateSlugUnique(dto.slug);

      // Validate parent exists if provided
      if (dto.parentId) {
        await this.validator.validateParentExists(dto.parentId);
      }

      // Create category
      const category = await this.prisma.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          parentId: dto.parentId,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      console.log(`[CategoriesService] Created category: ${category.id}`);
      return this.mapper.mapToCategoryResponse(category);
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[CategoriesService] create error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to create category',
      });
    }
  }

  /**
   * Update an existing category
   * @throws RpcException if category not found
   * @throws RpcException if slug already exists
   * @throws RpcException if trying to set self as parent or create circular reference
   */
  async update(id: string, dto: CategoryUpdateDto): Promise<CategoryResponse> {
    try {
      const existing = await this.getExistingCategory(id);
      await this.validator.validateSlugForUpdate(dto.slug, existing.slug);
      await this.validator.validateParentUpdate(id, dto.parentId);

      const updateData = this.buildUpdateData(dto);
      const category = await this.prisma.category.update({
        where: { id },
        data: updateData,
        include: {
          parent: true,
          children: true,
        },
      });

      console.log(`[CategoriesService] Updated category: ${id}`);
      return this.mapper.mapToCategoryResponse(category);
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[CategoriesService] update error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to update category',
      });
    }
  }

  /**
   * Delete a category
   * @throws RpcException if category not found
   * @throws RpcException if category has children or products
   */
  async delete(id: string): Promise<{ success: boolean; id: string }> {
    try {
      await this.validator.validateCanDelete(id);

      await this.prisma.category.delete({
        where: { id },
      });

      console.log(`[CategoriesService] Deleted category: ${id}`);
      return { success: true, id };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[CategoriesService] delete error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to delete category',
      });
    }
  }

  /**
   * Get existing category by ID
   * @throws RpcException if category not found
   * @private
   */
  private async getExistingCategory(id: string): Promise<{ id: string; slug: string }> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });

    if (!category) {
      throw new RpcException({
        statusCode: 404,
        message: `Category with ID ${id} not found`,
      });
    }

    return category;
  }

  /**
   * Build update data object from DTO
   * @private
   */
  private buildUpdateData(dto: CategoryUpdateDto): {
    name?: string;
    slug?: string;
    description?: string | null;
    parentId?: string | null;
  } {
    const updateData: {
      name?: string;
      slug?: string;
      description?: string | null;
      parentId?: string | null;
    } = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.slug) updateData.slug = dto.slug;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;

    return updateData;
  }
}
