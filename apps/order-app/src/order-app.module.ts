import { Module } from '@nestjs/common';
import { OrdersModule } from '@order-app/orders/orders.module';
import { OrderItemModule } from '@order-app/order-item/order-item.module';
import { PrismaService } from '@order-app/prisma/prisma.service';

@Module({
  imports: [OrdersModule, OrderItemModule],
  controllers: [],
  providers: [PrismaService],
})
export class OrderAppModule {}
