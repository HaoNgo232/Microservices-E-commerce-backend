import { Module } from '@nestjs/common';
import { ProductsModule } from '@product-app/products/products.module';
import { CategoriesModule } from '@product-app/categories/categories.module';
import { GlassesModule } from '@product-app/glasses/glasses.module';
import { PrismaService } from '@product-app/prisma/prisma.service';

@Module({
  imports: [ProductsModule, CategoriesModule, GlassesModule],
  providers: [PrismaService],
})
export class ProductAppModule {}
