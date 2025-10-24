import { Module } from '@nestjs/common';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';

@Module({
  providers: [CartItemService],
  exports: [CartItemService],
})
export class CartItemModule {}
