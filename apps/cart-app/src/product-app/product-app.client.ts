import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { EVENTS } from '@shared/events';
import {
  EntityNotFoundRpcException,
  ServiceUnavailableRpcException,
} from '@shared/exceptions/rpc-exceptions';

@Injectable()
export class ProductAppClient {
  constructor(@Inject('PRODUCT_SERVICE') private readonly client: ClientProxy) {}

  async getProductById(productId: string) {
    try {
      const product = await firstValueFrom(
        this.client.send(EVENTS.PRODUCT.GET_BY_ID, { id: productId }).pipe(
          timeout(5000), // 5s timeout
        ),
      );
      return product;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new ServiceUnavailableRpcException('Product service không phản hồi');
      }
      // Product not found or other error
      throw error;
    }
  }

  async getProductsByIds(productIds: string[]) {
    if (productIds.length === 0) return [];

    try {
      const products = await firstValueFrom(
        this.client.send(EVENTS.PRODUCT.GET_BY_IDS, { ids: productIds }).pipe(timeout(5000)),
      );
      return products;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new ServiceUnavailableRpcException('Product service không phản hồi');
      }
      throw error;
    }
  }
}
