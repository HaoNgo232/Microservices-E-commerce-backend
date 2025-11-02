import { Module } from '@nestjs/common';
import { CategoriesService } from '@product-app/categories/categories.service';
import { CategoriesController } from '@product-app/categories/categories.controller';
import { PrismaService } from '@product-app/prisma/prisma.service';
import { CategoryMapper } from '@product-app/categories/mappers/category.mapper';
import { CategoryValidator } from '@product-app/categories/validators/category.validator';
import { CategoryQueryBuilder } from '@product-app/categories/builders/category-query.builder';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, PrismaService, CategoryMapper, CategoryValidator, CategoryQueryBuilder],
  exports: [CategoriesService],
})
export class CategoriesModule {}
