import { Injectable } from '@nestjs/common';
import { CategoryListQueryDto } from '@shared/dto/category.dto';
import { PrismaService } from '@product-app/prisma/prisma.service';

/**
 * Query builder cho category list operations
 *
 * Tập trung logic xây dựng filter và query để:
 * - Giảm complexity trong service
 * - Tái sử dụng logic query
 * - Dễ dàng test và maintain
 */
@Injectable()
export class CategoryQueryBuilder {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xây dựng where clause từ query parameters
   *
   * Hỗ trợ filters:
   * - q: Tìm kiếm theo tên hoặc mô tả (case-insensitive)
   * - parentSlug: Lọc theo parent category slug
   *
   * @param query - Query parameters từ request
   * @returns Prisma where clause object
   */
  async buildWhereClause(query: CategoryListQueryDto): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = {};

    // Search filter
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // Parent filter
    if (query.parentSlug) {
      const parentCategory = await this.prisma.category.findUnique({
        where: { slug: query.parentSlug },
        select: { id: true },
      });

      if (parentCategory) {
        where.parentId = parentCategory.id;
      } else {
        // Return impossible condition if parent not found
        where.id = { equals: 'PARENT_NOT_FOUND' };
      }
    }

    return where;
  }

  /**
   * Lấy pagination parameters từ query
   *
   * @param query - Query với page và pageSize
   * @returns { skip, take } cho Prisma query
   */
  getPaginationParams(query: CategoryListQueryDto): { skip: number; take: number } {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    return { skip, take: pageSize };
  }

  /**
   * Tính toán pagination metadata
   *
   * @param page - Trang hiện tại
   * @param pageSize - Số items per page
   * @param total - Tổng số items
   * @returns Metadata với page, pageSize, totalPages
   */
  getPaginationMetadata(
    page: number,
    pageSize: number,
    total: number,
  ): {
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    return {
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
