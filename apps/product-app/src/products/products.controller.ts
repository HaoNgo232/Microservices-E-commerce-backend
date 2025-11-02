import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductsService } from '@product-app/products/products.service';
import { EVENTS } from '@shared/events';
import {
  ProductCreateDto,
  ProductUpdateDto,
  ProductListQueryDto,
  ProductIdDto,
  ProductIdsDto,
  ProductSlugDto,
} from '@shared/dto/product.dto';
import { PaginatedProductsResponse, ProductResponse } from '@shared/types';

export interface IProductsController {
  getById(dto: ProductIdDto): Promise<ProductResponse>;
  getByIds(dto: ProductIdsDto): Promise<ProductResponse[]>;
  getBySlug(dto: ProductSlugDto): Promise<ProductResponse>;
  list(query: ProductListQueryDto): Promise<PaginatedProductsResponse>;
  create(dto: ProductCreateDto): Promise<ProductResponse>;
  update(payload: { id: string; dto: ProductUpdateDto }): Promise<ProductResponse>;
  delete(id: string): Promise<{ success: boolean; id: string }>;
}

@Controller()
export class ProductsController implements IProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @MessagePattern(EVENTS.PRODUCT.GET_BY_ID)
  getById(@Payload() dto: ProductIdDto): Promise<ProductResponse> {
    return this.productsService.getById(dto);
  }

  @MessagePattern(EVENTS.PRODUCT.GET_BY_IDS)
  getByIds(@Payload() dto: ProductIdsDto): Promise<ProductResponse[]> {
    return this.productsService.getByIds(dto);
  }

  @MessagePattern(EVENTS.PRODUCT.GET_BY_SLUG)
  getBySlug(@Payload() dto: ProductSlugDto): Promise<ProductResponse> {
    return this.productsService.getBySlug(dto);
  }

  @MessagePattern(EVENTS.PRODUCT.LIST)
  list(@Payload() query: ProductListQueryDto): Promise<PaginatedProductsResponse> {
    console.log('ProductsController.list called with query:', query);
    return this.productsService.list(query);
  }

  @MessagePattern(EVENTS.PRODUCT.CREATE)
  create(@Payload() dto: ProductCreateDto): Promise<ProductResponse> {
    return this.productsService.create(dto);
  }

  @MessagePattern(EVENTS.PRODUCT.UPDATE)
  update(@Payload() payload: { id: string; dto: ProductUpdateDto }): Promise<ProductResponse> {
    return this.productsService.update(payload.id, payload.dto);
  }

  @MessagePattern(EVENTS.PRODUCT.DELETE)
  delete(@Payload() id: string): Promise<{ success: boolean; id: string }> {
    return this.productsService.delete(id);
  }
}
