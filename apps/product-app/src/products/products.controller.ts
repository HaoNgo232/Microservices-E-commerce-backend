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
  StockChangeDto,
} from '@shared/dto/product.dto';
import { PaginatedProductsResponse, ProductResponse, StockChangeResult } from '@shared/types';

export interface IProductsController {
  getById(dto: ProductIdDto): Promise<ProductResponse>;
  getByIds(dto: ProductIdsDto): Promise<ProductResponse[]>;
  getBySlug(dto: ProductSlugDto): Promise<ProductResponse>;
  list(query: ProductListQueryDto): Promise<PaginatedProductsResponse>;
  create(dto: ProductCreateDto): Promise<ProductResponse>;
  update(payload: { id: string; dto: ProductUpdateDto }): Promise<ProductResponse>;
  delete(id: string): Promise<{ success: boolean; id: string }>;
  incrementStock(dto: StockChangeDto): Promise<StockChangeResult>;
  decrementStock(dto: StockChangeDto): Promise<StockChangeResult>;
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

  @MessagePattern(EVENTS.PRODUCT.INC_STOCK)
  incrementStock(@Payload() dto: StockChangeDto): Promise<StockChangeResult> {
    return this.productsService.incrementStock(dto);
  }

  @MessagePattern(EVENTS.PRODUCT.DEC_STOCK)
  decrementStock(@Payload() dto: StockChangeDto): Promise<StockChangeResult> {
    return this.productsService.decrementStock(dto);
  }
}
