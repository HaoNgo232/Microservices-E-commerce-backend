import { Module } from '@nestjs/common';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';

@Module({
  providers: [CartItemService, PrismaService],
  exports: [CartItemService],
})
export class CartItemModule {}
