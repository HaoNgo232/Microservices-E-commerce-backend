import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ProductCreateDto, ProductUpdateDto, ProductListQueryDto } from '@shared/dto/product.dto';
import { AuthGuard } from '@gateway/auth/auth.guard';
import { RolesGuard } from '@gateway/auth/roles.guard';
import { Roles } from '@gateway/auth/roles.decorator';
import { UserRole } from '@shared/dto/user.dto';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { ProductResponse, PaginatedProductsResponse } from '@shared/types/product.types';
import { SuccessResponse } from '@shared/types/response.types';

/**
 * Products Controller
 * Gateway endpoint cho products - forward requests đến product-service
 */
@Controller('products')
export class ProductsController extends BaseGatewayController {
  constructor(@Inject('PRODUCT_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * GET /products/:id
   * Lấy chi tiết product theo ID
   */
  @Get(':id')
  findById(@Param('id') id: string): Promise<ProductResponse> {
    const payload = { id };
    return this.send<typeof payload, ProductResponse>(EVENTS.PRODUCT.GET_BY_ID, payload);
  }

  /**
   * GET /products/slug/:slug
   * Lấy chi tiết product theo slug
   * Note: Phải đặt route này TRƯỚC :id route để tránh conflict
   */
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string): Promise<ProductResponse> {
    return this.send<{ slug: string }, ProductResponse>(EVENTS.PRODUCT.GET_BY_SLUG, { slug });
  }

  /**
   * GET /products
   * Lấy danh sách products với pagination
   */
  @Get()
  list(@Query() query: ProductListQueryDto): Promise<PaginatedProductsResponse> {
    return this.send<ProductListQueryDto, PaginatedProductsResponse>(EVENTS.PRODUCT.LIST, query);
  }

  /**
   * POST /products
   * Tạo product mới (admin only)
   */
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: ProductCreateDto): Promise<ProductResponse> {
    return this.send<ProductCreateDto, ProductResponse>(EVENTS.PRODUCT.CREATE, dto);
  }

  /**
   * PUT /products/:id
   * Cập nhật product (admin only)
   *
   * Pattern: Combine path param + body DTO
   * Gateway gửi: { id: string; dto: ProductUpdateDto }
   * Microservice nhận: { id: string; dto: ProductUpdateDto }
   */
  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: ProductUpdateDto): Promise<ProductResponse> {
    const payload = { id, dto };

    return this.send<typeof payload, ProductResponse>(EVENTS.PRODUCT.UPDATE, payload);
  }

  /**
   * DELETE /products/:id
   * Xóa product (admin only)
   */
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  delete(@Param('id') id: string): Promise<SuccessResponse> {
    return this.send<string, SuccessResponse>(EVENTS.PRODUCT.DELETE, id);
  }
}
