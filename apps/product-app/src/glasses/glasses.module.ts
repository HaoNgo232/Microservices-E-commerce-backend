import { Module } from '@nestjs/common';
import { GlassesService } from '@product-app/glasses/glasses.service';
import { GlassesController } from '@product-app/glasses/glasses.controller';
import { PrismaService } from '@product-app/prisma/prisma.service';
import { MinioModule } from '@product-app/minio/minio.module';

@Module({
  imports: [MinioModule],
  controllers: [GlassesController],
  providers: [GlassesService, PrismaService],
  exports: [GlassesService],
})
export class GlassesModule {}

