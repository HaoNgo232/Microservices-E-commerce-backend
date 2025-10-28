import { Module } from '@nestjs/common';
import { ArModule } from '@ar-app/ar/ar.module';
import { PrismaService } from '@ar-app/prisma/prisma.service';

@Module({
  imports: [ArModule],
  controllers: [],
  providers: [PrismaService],
})
export class ArAppModule {}
