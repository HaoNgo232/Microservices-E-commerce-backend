import { Module } from '@nestjs/common';
import { ProductsService } from '@product-app/products/products.service';
import { ProductsController } from '@product-app/products/products.controller';
import { PrismaService } from '@product-app/prisma/prisma.service';
import { ProductQueryBuilder } from '@product-app/products/builders/product-query.builder';
import { MinioModule } from '@product-app/minio/minio.module';

@Module({
  imports: [MinioModule],
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService, ProductQueryBuilder],
  exports: [ProductsService],
})
export class ProductsModule {}
