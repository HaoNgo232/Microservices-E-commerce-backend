import { Module } from '@nestjs/common';
import { CartModule } from '@cart-app/cart/cart.module';
import { PrismaService } from '@cart-app/prisma/prisma.service';

@Module({
  imports: [CartModule],
  controllers: [],
  providers: [PrismaService],
})
export class CartAppModule {}
