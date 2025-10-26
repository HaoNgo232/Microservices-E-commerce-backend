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
import { ProductCreateDto, ProductUpdateDto, ProductListQueryDto } from '@shared/dto/product.dto';
import { AuthGuard } from '../auth/auth.guard';
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
   * GET /products
   * Lấy danh sách products với pagination
   */
  @Get()
  async list(@Query() query: ProductListQueryDto): Promise<PaginatedProductsResponse> {
    return await this.send<ProductListQueryDto, PaginatedProductsResponse>(
      EVENTS.PRODUCT.LIST,
      query,
    );
  }

  /**
   * GET /products/:id
   * Lấy chi tiết product theo ID
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<ProductResponse> {
    return await this.send<string, ProductResponse>(EVENTS.PRODUCT.GET_BY_ID, id);
  }

  /**
   * GET /products/slug/:slug
   * Lấy chi tiết product theo slug
   */
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<ProductResponse> {
    return await this.send<{ slug: string }, ProductResponse>(EVENTS.PRODUCT.GET_BY_SLUG, { slug });
  }

  /**
   * POST /products
   * Tạo product mới (admin only)
   */
  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() dto: ProductCreateDto): Promise<ProductResponse> {
    return await this.send<ProductCreateDto, ProductResponse>(EVENTS.PRODUCT.CREATE, dto);
  }

  /**
   * PUT /products/:id
   * Cập nhật product (admin only)
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  async update(@Param('id') id: string, @Body() dto: ProductUpdateDto): Promise<ProductResponse> {
    return await this.send<ProductUpdateDto & { id: string }, ProductResponse>(
      EVENTS.PRODUCT.UPDATE,
      {
        id,
        ...dto,
      },
    );
  }

  /**
   * DELETE /products/:id
   * Xóa product (admin only)
   */
  @Delete(':id')
  @UseGuards(AuthGuard)
  async delete(@Param('id') id: string): Promise<SuccessResponse> {
    return await this.send<string, SuccessResponse>(EVENTS.PRODUCT.DELETE, id);
  }
}
