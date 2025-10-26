import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

describe('CartController', () => {
  let controller: CartController;
  let mockCartService: jest.Mocked<CartService>;

  const mockCartData = {
    cart: {
      id: 'cart-123',
      sessionId: 'session-123',
      userId: 'user123',
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    totalInt: 0,
    items: [],
  };

  const mockCartItem = {
    id: 'item-123',
    cartId: 'cart-123',
    productId: 'product-123',
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockCartServiceInstance = {
      get: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        {
          provide: CartService,
          useValue: mockCartServiceInstance,
        },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
    mockCartService = module.get(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should call CartService.get and return result', async () => {
      mockCartService.get.mockResolvedValue(mockCartData);

      const result = await controller.get({ userId: 'user123' });

      expect(result).toEqual(mockCartData);
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should re-throw RPC exceptions', async () => {
      const rpcError = new RpcException({ statusCode: 400, message: 'Validation error' });
      mockCartService.get.mockRejectedValue(rpcError);

      await expect(controller.get({ userId: 'user123' })).rejects.toThrow(rpcError);
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should wrap unexpected errors', async () => {
      const unexpectedError = new Error('Database connection failed');
      mockCartService.get.mockRejectedValue(unexpectedError);

      await expect(controller.get({ userId: 'user123' })).rejects.toThrow(unexpectedError);
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });
  });

  describe('addItem', () => {
    it('should call CartService.addItem and return result', async () => {
      const addItemData = { userId: 'user123', productId: 'product-123', quantity: 2 };
      const expectedResult = { cartItem: mockCartItem };
      mockCartService.addItem.mockResolvedValue(expectedResult);

      const result = await controller.addItem(addItemData);

      expect(result).toEqual(expectedResult);
      expect(mockCartService.addItem).toHaveBeenCalledWith(addItemData);
    });

    it('should re-throw RPC exceptions', async () => {
      const addItemData = { userId: 'user123', productId: 'product-123', quantity: 2 };
      const rpcError = new RpcException({ statusCode: 404, message: 'Product not found' });
      mockCartService.addItem.mockRejectedValue(rpcError);

      await expect(controller.addItem(addItemData)).rejects.toThrow(rpcError);
      expect(mockCartService.addItem).toHaveBeenCalledWith(addItemData);
    });
  });

  describe('updateItem', () => {
    it('should call CartService.updateItem and return result', async () => {
      const updateItemData = { userId: 'user123', productId: 'product-123', quantity: 5 };
      const expectedResult = { cartItem: mockCartItem };
      mockCartService.updateItem.mockResolvedValue(expectedResult);

      const result = await controller.updateItem(updateItemData);

      expect(result).toEqual(expectedResult);
      expect(mockCartService.updateItem).toHaveBeenCalledWith(updateItemData);
    });

    it('should re-throw RPC exceptions', async () => {
      const updateItemData = { userId: 'user123', productId: 'product-123', quantity: 5 };
      const rpcError = new RpcException({ statusCode: 404, message: 'CartItem not found' });
      mockCartService.updateItem.mockRejectedValue(rpcError);

      await expect(controller.updateItem(updateItemData)).rejects.toThrow(rpcError);
      expect(mockCartService.updateItem).toHaveBeenCalledWith(updateItemData);
    });
  });

  describe('removeItem', () => {
    it('should call CartService.removeItem and return result', async () => {
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const expectedResult = { success: true };
      mockCartService.removeItem.mockResolvedValue(expectedResult);

      const result = await controller.removeItem(removeItemData);

      expect(result).toEqual(expectedResult);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
    });

    it('should re-throw RPC exceptions', async () => {
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const rpcError = new RpcException({ statusCode: 500, message: 'Database error' });
      mockCartService.removeItem.mockRejectedValue(rpcError);

      await expect(controller.removeItem(removeItemData)).rejects.toThrow(rpcError);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
    });
  });
});
