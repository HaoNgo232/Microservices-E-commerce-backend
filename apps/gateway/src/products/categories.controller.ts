import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CategoryCreateDto,
  CategoryUpdateDto,
  CategoryListQueryDto,
} from '@shared/dto/category.dto';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { CategoryResponse, PaginatedCategoriesResponse } from '@shared/types/product.types';
import { SuccessResponse } from '@shared/types/response.types';
import { Roles, RolesGuard } from '@gateway/auth';
import { UserRole } from '@shared/main';

/**
 * Categories Controller
 * Gateway endpoint cho product categories - forward requests đến product-service
 */
@Controller('categories')
export class CategoriesController extends BaseGatewayController {
  constructor(@Inject('PRODUCT_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * GET /categories
   * Lấy danh sách categories với pagination
   */
  @Get()
  list(@Query() query: CategoryListQueryDto): Promise<PaginatedCategoriesResponse> {
    return this.send<CategoryListQueryDto, PaginatedCategoriesResponse>(
      EVENTS.CATEGORY.LIST,
      query,
    );
  }

  /**
   * GET /categories/slug/:slug
   * Lấy chi tiết category theo slug
   * Note: Phải đặt route này TRƯỚC :id route để tránh conflict
   */
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string): Promise<CategoryResponse> {
    return this.send<{ slug: string }, CategoryResponse>(EVENTS.CATEGORY.GET_BY_SLUG, {
      slug,
    });
  }

  /**
   * GET /categories/:id
   * Lấy chi tiết category theo ID (bao gồm children nếu có)
   */
  @Get(':id')
  findById(@Param('id') id: string): Promise<CategoryResponse> {
    return this.send<string, CategoryResponse>(EVENTS.CATEGORY.GET_BY_ID, id);
  }

  /**
   * POST /categories
   * Tạo category mới (admin only)
   */
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CategoryCreateDto): Promise<CategoryResponse> {
    return this.send<CategoryCreateDto, CategoryResponse>(EVENTS.CATEGORY.CREATE, dto);
  }

  /**
   * PUT /categories/:id
   * Cập nhật category (admin only)
   *
   * Pattern: Combine path param + body DTO
   * Gateway gửi: { id: string; dto: CategoryUpdateDto }
   * Microservice nhận: { id: string; dto: CategoryUpdateDto }
   */
  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: CategoryUpdateDto): Promise<CategoryResponse> {
    const payload = { id, dto };

    return this.send<typeof payload, CategoryResponse>(EVENTS.CATEGORY.UPDATE, payload);
  }

  /**
   * DELETE /categories/:id
   * Xóa category (admin only)
   */
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  delete(@Param('id') id: string): Promise<SuccessResponse> {
    return this.send<string, SuccessResponse>(EVENTS.CATEGORY.DELETE, id);
  }
}
