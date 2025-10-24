import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CartService } from '@cart-app/cart/cart.service';
import { CartController } from '@cart-app/cart/cart.controller';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PRODUCT_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        },
      },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartItemService, PrismaService],
  exports: [CartService],
})
export class CartModule {}
