import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CategoriesService } from '@product-app/categories/categories.service';
import { EVENTS } from '@shared/events';
import {
  CategoryCreateDto,
  CategoryUpdateDto,
  CategoryIdDto,
  CategorySlugDto,
  CategoryListQueryDto,
} from '@shared/dto/category.dto';
import { CategoryResponse, PaginatedCategoriesResponse } from '@shared/types/product.types';

export interface ICategoriesController {
  getById(dto: CategoryIdDto): Promise<CategoryResponse>;
  getBySlug(dto: CategorySlugDto): Promise<CategoryResponse>;
  list(query: CategoryListQueryDto): Promise<PaginatedCategoriesResponse>;
  create(dto: CategoryCreateDto): Promise<CategoryResponse>;
  update(payload: { id: string; dto: CategoryUpdateDto }): Promise<CategoryResponse>;
  delete(id: string): Promise<{ success: boolean; id: string }>;
}

@Controller()
export class CategoriesController implements ICategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @MessagePattern(EVENTS.CATEGORY.GET_BY_ID)
  getById(@Payload() dto: CategoryIdDto): Promise<CategoryResponse> {
    return this.categoriesService.getById(dto);
  }

  @MessagePattern(EVENTS.CATEGORY.GET_BY_SLUG)
  getBySlug(@Payload() dto: CategorySlugDto): Promise<CategoryResponse> {
    return this.categoriesService.getBySlug(dto);
  }

  @MessagePattern(EVENTS.CATEGORY.LIST)
  list(@Payload() query: CategoryListQueryDto): Promise<PaginatedCategoriesResponse> {
    return this.categoriesService.list(query);
  }

  @MessagePattern(EVENTS.CATEGORY.CREATE)
  create(@Payload() dto: CategoryCreateDto): Promise<CategoryResponse> {
    return this.categoriesService.create(dto);
  }

  @MessagePattern(EVENTS.CATEGORY.UPDATE)
  update(@Payload() payload: { id: string; dto: CategoryUpdateDto }): Promise<CategoryResponse> {
    return this.categoriesService.update(payload.id, payload.dto);
  }

  @MessagePattern(EVENTS.CATEGORY.DELETE)
  delete(@Payload() id: string): Promise<{ success: boolean; id: string }> {
    return this.categoriesService.delete(id);
  }
}
