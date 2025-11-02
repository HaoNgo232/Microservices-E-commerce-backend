import { Module } from '@nestjs/common';
import { OrderItemService } from '@order-app/order-item/order-item.service';
import { PrismaService } from '@order-app/prisma/prisma.service';

@Module({
  controllers: [],
  providers: [OrderItemService, PrismaService],
  exports: [OrderItemService],
})
export class OrderItemModule {}
