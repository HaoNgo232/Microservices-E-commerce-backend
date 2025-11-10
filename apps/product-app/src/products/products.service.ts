import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { Prisma } from '../../prisma/generated/client';
import {
  ProductCreateDto,
  ProductUpdateDto,
  ProductListQueryDto,
  ProductIdDto,
  ProductIdsDto,
  ProductSlugDto,
  AdminCreateProductDto,
  AdminUpdateProductDto,
} from '@shared/dto/product.dto';
import { ProductResponse, PaginatedProductsResponse, ProductAttributes } from '@shared/types/product.types';
import { PrismaService } from '@product-app/prisma/prisma.service';
import { EntityNotFoundRpcException, InternalServerRpcException } from '@shared/main';
import { ProductQueryBuilder } from '@product-app/products/builders/product-query.builder';
import { MinioService, BufferedFile } from '@product-app/minio/minio.service';

export interface IProductsService {
  getById(dto: ProductIdDto): Promise<ProductResponse>;
  getByIds(dto: ProductIdsDto): Promise<ProductResponse[]>;
  getBySlug(dto: ProductSlugDto): Promise<ProductResponse>;
  list(query: ProductListQueryDto): Promise<PaginatedProductsResponse>;
  create(dto: ProductCreateDto): Promise<ProductResponse>;
  update(id: string, dto: ProductUpdateDto): Promise<ProductResponse>;
  delete(id: string): Promise<{ success: boolean; id: string }>;
  decrementStock(id: string, quantity: number): Promise<ProductResponse>;
  incrementStock(id: string, quantity: number): Promise<ProductResponse>;
}

@Injectable()
export class ProductsService implements IProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBuilder: ProductQueryBuilder,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Get product by ID
   * @throws RpcException if product not found
   */
  async getById(dto: ProductIdDto): Promise<ProductResponse> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.id },
        include: {
          category: true,
        },
      });

      if (!product) {
        throw new EntityNotFoundRpcException('Product', dto.id);
      }

      return {
        ...product,
        attributes: product.attributes as ProductAttributes,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] getById error:', error);
      throw new InternalServerRpcException('Failed to retrieve product');
    }
  }

  /**
   * Get multiple products by IDs
   * Returns only found products (doesn't throw if some IDs not found)
   */
  async getByIds(dto: ProductIdsDto): Promise<ProductResponse[]> {
    try {
      if (dto.ids.length === 0) {
        return [];
      }

      const products = await this.prisma.product.findMany({
        where: {
          id: {
            in: dto.ids,
          },
        },
        include: {
          category: true,
        },
      });

      const results = products.map(product => ({
        ...product,
        attributes: product.attributes as ProductAttributes,
      }));

      return results;
    } catch (error) {
      console.error('[ProductsService] getByIds error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to retrieve products',
      });
    }
  }

  /**
   * Get product by slug
   * @throws RpcException if product not found
   */
  async getBySlug(dto: ProductSlugDto): Promise<ProductResponse> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
        include: {
          category: true,
        },
      });

      if (!product) {
        throw new RpcException({
          statusCode: 404,
          message: `Product with slug '${dto.slug}' not found`,
        });
      }

      const results = {
        ...product,
        attributes: product.attributes as ProductAttributes,
      };

      return results;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] getBySlug error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to retrieve product',
      });
    }
  }

  /**
   * List products with pagination and filters
   */
  async list(query: ProductListQueryDto): Promise<PaginatedProductsResponse> {
    try {
      console.log('[ProductService] list called with query:', query);

      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const { skip, take } = this.queryBuilder.getPaginationParams(query);

      console.log('[ProductService] pagination:', { page, pageSize, skip, take });

      const where = this.queryBuilder.buildWhereClause(query);

      // Execute queries in parallel
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: {
            category: true,
          },
          skip,
          take,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      console.log('[ProductService] results:', { total, fetched: products.length });

      const { totalPages } = this.queryBuilder.getPaginationMetadata(page, pageSize, total);

      const formattedProducts = products.map(p => ({
        ...p,
        attributes: p.attributes as ProductAttributes,
      }));

      return {
        products: formattedProducts,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      console.error('[ProductsService] list error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to retrieve products',
      });
    }
  }

  /**
   * Create a new product
   * @throws RpcException if SKU or slug already exists
   * @throws RpcException if category doesn't exist
   */
  async create(dto: ProductCreateDto): Promise<ProductResponse> {
    try {
      // Validate SKU uniqueness
      const existingSku = await this.prisma.product.findFirst({
        where: { sku: dto.sku },
      });
      if (existingSku) {
        throw new RpcException({
          statusCode: 409,
          message: `SKU '${dto.sku}' already exists`,
        });
      }

      // Validate slug uniqueness
      const existingSlug = await this.prisma.product.findFirst({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new RpcException({
          statusCode: 409,
          message: `Slug '${dto.slug}' already exists`,
        });
      }

      // Create product
      const product = await this.prisma.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          slug: dto.slug,
          priceInt: dto.priceInt,
          stock: dto.stock ?? 0,
          description: dto.description,
          imageUrls: dto.imageUrls ?? [],
          categoryId: dto.categoryId,
          attributes: dto.attributes as never,
          model3dUrl: dto.model3dUrl,
        },
        include: {
          category: true,
        },
      });

      console.log(`[ProductsService] Created product: ${product.id}`);
      return {
        ...product,
        attributes: product.attributes as ProductAttributes,
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[ProductsService] create error:', error);
      throw new InternalServerRpcException('Failed to create product');
    }
  }

  /**
   * Update an existing product
   * @throws RpcException if product not found
   * @throws RpcException if slug already exists
   */
  async update(id: string, dto: ProductUpdateDto): Promise<ProductResponse> {
    try {
      // Check product exists
      const existing = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new EntityNotFoundRpcException('Product', id);
      }

      // Validate slug uniqueness if updating slug
      if (dto.slug && dto.slug !== existing.slug) {
        const existingSlug = await this.prisma.product.findFirst({
          where: { slug: dto.slug },
        });
        if (existingSlug) {
          throw new RpcException({
            statusCode: 409,
            message: `Slug '${dto.slug}' already exists`,
          });
        }
      }

      // Build update data object
      const updateData = this.buildProductUpdateData(dto);

      // Update product
      const product = await this.prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
        },
      });

      console.log(`[ProductsService] Updated product: ${id}`);
      return {
        ...product,
        attributes: product.attributes as ProductAttributes,
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      console.error('[ProductsService] update error:', error);
      throw new InternalServerRpcException('Failed to update product');
    }
  }

  /**
   * Delete a product
   * @throws RpcException if product not found
   */
  async delete(id: string): Promise<{ success: boolean; id: string }> {
    try {
      const existing = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new RpcException({
          statusCode: 404,
          message: `Product with ID ${id} not found`,
        });
      }

      await this.prisma.product.delete({
        where: { id },
      });

      console.log(`[ProductsService] Deleted product: ${id}`);
      return { success: true, id };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] delete error:', error);
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to delete product',
      });
    }
  }

  /**
   * Build update data object from DTO
   * @private
   */
  private buildProductUpdateData(dto: ProductUpdateDto): {
    name?: string;
    slug?: string;
    priceInt?: number;
    stock?: number;
    description?: string | null;
    imageUrls?: string[];
    categoryId?: string | null;
    attributes?: never;
    model3dUrl?: string | null;
  } {
    const updateData: {
      name?: string;
      slug?: string;
      priceInt?: number;
      stock?: number;
      description?: string | null;
      imageUrls?: string[];
      categoryId?: string | null;
      attributes?: never;
      model3dUrl?: string | null;
    } = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.slug) updateData.slug = dto.slug;
    if (dto.priceInt !== undefined) updateData.priceInt = dto.priceInt;
    if (dto.stock !== undefined) updateData.stock = dto.stock;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.imageUrls) updateData.imageUrls = dto.imageUrls;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.attributes !== undefined) updateData.attributes = dto.attributes as never;
    if (dto.model3dUrl !== undefined) updateData.model3dUrl = dto.model3dUrl;

    return updateData;
  }

  /**
   * Decrement product stock (called when order is created)
   * Used by order-app to reduce stock after order creation
   *
   * @param productId - Product ID
   * @param quantity - Quantity to decrement
   * @throws EntityNotFoundRpcException if product not found
   * @throws RpcException if stock is insufficient
   */
  async decrementStock(productId: string, quantity: number): Promise<ProductResponse> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { category: true },
      });

      if (!product) {
        throw new EntityNotFoundRpcException('Product', productId);
      }

      if (product.stock < quantity) {
        throw new RpcException({
          statusCode: 400,
          message: `Insufficient stock for product ${productId}. Available: ${product.stock}, Requested: ${quantity}`,
        });
      }

      const updated = await this.prisma.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } },
        include: { category: true },
      });

      return {
        ...updated,
        attributes: updated.attributes as ProductAttributes,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] decrementStock error:', error);
      throw new InternalServerRpcException('Failed to decrement stock');
    }
  }

  /**
   * Increment product stock (called when order is cancelled)
   * Used by order-app to restore stock after order cancellation
   *
   * @param productId - Product ID
   * @param quantity - Quantity to increment
   * @throws EntityNotFoundRpcException if product not found
   */
  async incrementStock(productId: string, quantity: number): Promise<ProductResponse> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { category: true },
      });

      if (!product) {
        throw new EntityNotFoundRpcException('Product', productId);
      }

      const updated = await this.prisma.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } },
        include: { category: true },
      });

      return {
        ...updated,
        attributes: updated.attributes as ProductAttributes,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] incrementStock error:', error);
      throw new InternalServerRpcException('Failed to increment stock');
    }
  }

  /**
   * Admin: Create product with image upload support
   */
  async adminCreate(dto: AdminCreateProductDto): Promise<ProductResponse> {
    try {
      let imageUrl: string | undefined;
      let imageFilename: string | undefined;

      // Handle file upload if present
      if (dto.fileBuffer && dto.fileOriginalname && dto.fileMimetype) {
        const file: BufferedFile = {
          fieldname: 'image',
          originalname: dto.fileOriginalname,
          encoding: '7bit',
          mimetype: dto.fileMimetype,
          size: dto.fileSize || 0,
          buffer: Buffer.from(dto.fileBuffer, 'base64'),
        };

        const uploaded = await this.minioService.uploadImage(file);
        imageUrl = uploaded.url;
        imageFilename = uploaded.filename;
      }

      // Auto-generate sku and slug if not provided
      const sku = dto.sku || `SKU-${Date.now()}`;
      const slug = dto.slug || dto.name.toLowerCase().replaceAll(' ', '-');

      const product = await this.prisma.product.create({
        data: {
          name: dto.name,
          sku,
          slug,
          priceInt: dto.priceInt,
          description: dto.description,
          categoryId: dto.categoryId,
          stock: dto.stock || 0,
          imageUrl,
          imageFilename,
          imageUrls: imageUrl ? [imageUrl] : [], // Also add to imageUrls for compatibility
          attributes: dto.attributes as Prisma.InputJsonValue | undefined,
          model3dUrl: dto.model3dUrl,
        },
        include: { category: true },
      });

      return {
        ...product,
        attributes: product.attributes as ProductAttributes,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] adminCreate error:', error);
      throw new InternalServerRpcException('Failed to create product');
    }
  }

  /**
   * Admin: Update product with optional image upload
   */
  async adminUpdate(id: string, dto: AdminUpdateProductDto): Promise<ProductResponse> {
    try {
      const existing = await this.prisma.product.findUnique({ where: { id } });
      if (!existing) {
        throw new EntityNotFoundRpcException('Product', id);
      }

      const imageData = await this.handleImageUploadIfNeeded(dto, (existing.imageFilename as string) ?? null);
      const updateData = this.buildAdminUpdateData(dto, imageData);

      return await this.updateProductAndReturn(id, updateData);
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] adminUpdate error:', error);
      throw new InternalServerRpcException('Failed to update product');
    }
  }

  /**
   * Handle image upload if file is provided in DTO
   * @private
   */
  private async handleImageUploadIfNeeded(
    dto: AdminUpdateProductDto,
    existingImageFilename: string | null,
  ): Promise<{ imageUrl: string; imageFilename: string } | null> {
    if (!dto.fileBuffer || !dto.fileOriginalname || !dto.fileMimetype) {
      return null;
    }

    if (existingImageFilename) {
      await this.minioService.deleteImage(existingImageFilename);
    }

    const file: BufferedFile = {
      fieldname: 'image',
      originalname: dto.fileOriginalname,
      encoding: '7bit',
      mimetype: dto.fileMimetype,
      size: dto.fileSize || 0,
      buffer: Buffer.from(dto.fileBuffer, 'base64'),
    };

    const uploaded = await this.minioService.uploadImage(file);
    return {
      imageUrl: uploaded.url,
      imageFilename: uploaded.filename,
    };
  }

  /**
   * Build update data object from DTO and optional image data
   * @private
   */
  private buildAdminUpdateData(
    dto: AdminUpdateProductDto,
    imageData: { imageUrl: string; imageFilename: string } | null,
  ): Prisma.ProductUncheckedUpdateInput {
    const updateData: Prisma.ProductUncheckedUpdateInput = {};

    if (imageData) {
      updateData.imageUrl = imageData.imageUrl;
      updateData.imageFilename = imageData.imageFilename;
      updateData.imageUrls = [imageData.imageUrl];
    }

    if (dto.name) updateData.name = dto.name;
    if (dto.slug) updateData.slug = dto.slug;
    if (dto.priceInt !== undefined) updateData.priceInt = dto.priceInt;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.sku) updateData.sku = dto.sku;
    if (dto.stock !== undefined) updateData.stock = dto.stock;
    if (dto.attributes) updateData.attributes = dto.attributes as Prisma.InputJsonValue;
    if (dto.model3dUrl !== undefined) updateData.model3dUrl = dto.model3dUrl;

    return updateData;
  }

  /**
   * Update product and return formatted response
   * @private
   */
  private async updateProductAndReturn(
    id: string,
    updateData: Prisma.ProductUncheckedUpdateInput,
  ): Promise<ProductResponse> {
    const product = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    return {
      ...product,
      attributes: product.attributes as ProductAttributes,
    };
  }

  /**
   * Admin: Delete product and image
   */
  async adminDelete(id: string): Promise<{ success: boolean; id: string }> {
    try {
      const product = await this.prisma.product.findUnique({ where: { id } });
      if (!product) {
        throw new EntityNotFoundRpcException('Product', id);
      }

      // Delete image from MinIO if exists
      if (product.imageFilename) {
        await this.minioService.deleteImage(product.imageFilename);
      }

      // Soft delete (or hard delete - adjust as needed)
      await this.prisma.product.delete({ where: { id } });

      return { success: true, id };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      console.error('[ProductsService] adminDelete error:', error);
      throw new InternalServerRpcException('Failed to delete product');
    }
  }
}
