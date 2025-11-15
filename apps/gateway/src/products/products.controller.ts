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
  UploadedFile,
  UseInterceptors,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProductCreateDto,
  ProductUpdateDto,
  ProductListQueryDto,
  AdminCreateProductDto,
  AdminUpdateProductDto,
} from '@shared/dto/product.dto';
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
   * Lưu ý: Đặt route này trước `/products/:id` để tránh xung đột
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
    console.log('[Gateway] Raw query params:', query);
    console.log('[Gateway] Query types:', {
      page: typeof query.page,
      pageSize: typeof query.pageSize,
    });

    // Transform string query params to correct types
    const transformedQuery: ProductListQueryDto = {
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      search: query.search,
      categorySlug: query.categorySlug,
      minPriceInt: query.minPriceInt ? Number(query.minPriceInt) : undefined,
      maxPriceInt: query.maxPriceInt ? Number(query.maxPriceInt) : undefined,
    };

    console.log('[Gateway] Transformed query:', transformedQuery);
    return this.send<ProductListQueryDto, PaginatedProductsResponse>(EVENTS.PRODUCT.LIST, transformedQuery);
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
   * PATCH /products/:id
   * Cập nhật product (admin only)
   *
   * Pattern: Combine path param + body DTO
   * Gateway gửi: { id: string; dto: ProductUpdateDto }
   * Microservice nhận: { id: string; dto: ProductUpdateDto }
   */
  @Patch(':id')
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

  /**
   * POST /products/admin
   * Create product with image upload (admin only)
   */
  @Post('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  async adminCreate(
    @Body() dto: AdminCreateProductDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<ProductResponse> {
    const payload: AdminCreateProductDto = {
      ...dto,
      // Convert numbers from string (form-data)
      priceInt: Number(dto.priceInt),
      stock: dto.stock ? Number(dto.stock) : undefined,
    };

    // Serialize file for NATS if present
    if (image && image.buffer) {
      const buffer = Buffer.isBuffer(image.buffer) ? image.buffer : Buffer.from(image.buffer as ArrayLike<number>);
      payload.fileBuffer = buffer.toString('base64');
      payload.fileOriginalname = image.originalname;
      payload.fileMimetype = image.mimetype;
      payload.fileSize = image.size;
    }

    return this.send<AdminCreateProductDto, ProductResponse>(EVENTS.PRODUCT.ADMIN_CREATE, payload);
  }

  /**
   * PUT /products/admin/:id
   * Update product with optional image upload (admin only)
   */
  @Put('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  async adminUpdate(
    @Param('id') id: string,
    @Body() dto: AdminUpdateProductDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<ProductResponse> {
    const payload: AdminUpdateProductDto = {
      ...dto,
      // Convert numbers from string (form-data)
      priceInt: dto.priceInt ? Number(dto.priceInt) : undefined,
      stock: dto.stock ? Number(dto.stock) : undefined,
    };

    // Serialize file for NATS if present
    if (image && image.buffer) {
      const buffer = Buffer.isBuffer(image.buffer) ? image.buffer : Buffer.from(image.buffer as ArrayLike<number>);
      payload.fileBuffer = buffer.toString('base64');
      payload.fileOriginalname = image.originalname;
      payload.fileMimetype = image.mimetype;
      payload.fileSize = image.size;
    }

    return this.send<{ id: string; dto: AdminUpdateProductDto }, ProductResponse>(EVENTS.PRODUCT.ADMIN_UPDATE, {
      id,
      dto: payload,
    });
  }

  /**
   * DELETE /products/admin/:id
   * Delete product and image (admin only)
   */
  @Delete('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminDelete(@Param('id') id: string): Promise<SuccessResponse> {
    return this.send<string, SuccessResponse>(EVENTS.PRODUCT.ADMIN_DELETE, id);
  }
}
