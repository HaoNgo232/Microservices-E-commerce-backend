import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { InternalServerRpcException } from '@shared/exceptions/rpc-exceptions';

describe('CartController', () => {
  let controller: CartController;
  let mockCartService: jest.Mocked<CartService>;

  const mockCartData = {
    cart: {
      id: 'cart-123',
      userId: 'user123',
      items: [],
    },
    totalInt: 0,
    items: [],
  };

  const mockCartItem = {
    id: 'item-123',
    productId: 'product-123',
    quantity: 2,
  };

  beforeEach(async () => {
    const mockCartServiceInstance = {
      get: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      merge: jest.fn(),
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
      // Arrange
      mockCartService.get.mockResolvedValue(mockCartData);

      // Act
      const result = await controller.get({ userId: 'user123' });

      // Assert
      expect(result).toEqual(mockCartData);
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should re-throw RPC exceptions', async () => {
      // Arrange
      const rpcError = new RpcException({ statusCode: 400, message: 'Validation error' });
      mockCartService.get.mockRejectedValue(rpcError);

      // Act & Assert
      await expect(controller.get({ userId: 'user123' })).rejects.toThrow(rpcError);
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockCartService.get.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(controller.get({ userId: 'user123' })).rejects.toThrow(
        InternalServerRpcException,
      );
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });
  });

  describe('addItem', () => {
    it('should call CartService.addItem and return result', async () => {
      // Arrange
      const addItemData = { userId: 'user123', productId: 'product-123', quantity: 2 };
      const expectedResult = { cartItem: mockCartItem };
      mockCartService.addItem.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.addItem(addItemData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCartService.addItem).toHaveBeenCalledWith(addItemData);
    });

    it('should re-throw RPC exceptions', async () => {
      // Arrange
      const addItemData = { userId: 'user123', productId: 'product-123', quantity: 2 };
      const rpcError = new RpcException({ statusCode: 404, message: 'Product not found' });
      mockCartService.addItem.mockRejectedValue(rpcError);

      // Act & Assert
      await expect(controller.addItem(addItemData)).rejects.toThrow(rpcError);
      expect(mockCartService.addItem).toHaveBeenCalledWith(addItemData);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      const addItemData = { userId: 'user123', productId: 'product-123', quantity: 2 };
      const unexpectedError = new Error('Unexpected error');
      mockCartService.addItem.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(controller.addItem(addItemData)).rejects.toThrow(InternalServerRpcException);
      expect(mockCartService.addItem).toHaveBeenCalledWith(addItemData);
    });
  });

  describe('updateItem', () => {
    it('should call CartService.updateItem and return result', async () => {
      // Arrange
      const updateItemData = { userId: 'user123', productId: 'product-123', quantity: 5 };
      const expectedResult = { cartItem: mockCartItem };
      mockCartService.updateItem.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateItem(updateItemData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCartService.updateItem).toHaveBeenCalledWith(updateItemData);
    });

    it('should re-throw RPC exceptions', async () => {
      // Arrange
      const updateItemData = { userId: 'user123', productId: 'product-123', quantity: 5 };
      const rpcError = new RpcException({ statusCode: 404, message: 'CartItem not found' });
      mockCartService.updateItem.mockRejectedValue(rpcError);

      // Act & Assert
      await expect(controller.updateItem(updateItemData)).rejects.toThrow(rpcError);
      expect(mockCartService.updateItem).toHaveBeenCalledWith(updateItemData);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      const updateItemData = { userId: 'user123', productId: 'product-123', quantity: 5 };
      const unexpectedError = new Error('Unexpected error');
      mockCartService.updateItem.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(controller.updateItem(updateItemData)).rejects.toThrow(
        InternalServerRpcException,
      );
      expect(mockCartService.updateItem).toHaveBeenCalledWith(updateItemData);
    });
  });

  describe('removeItem', () => {
    it('should call CartService.removeItem and return result', async () => {
      // Arrange
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const expectedResult = { success: true };
      mockCartService.removeItem.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.removeItem(removeItemData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
    });

    it('should re-throw RPC exceptions', async () => {
      // Arrange
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const rpcError = new RpcException({ statusCode: 500, message: 'Database error' });
      mockCartService.removeItem.mockRejectedValue(rpcError);

      // Act & Assert
      await expect(controller.removeItem(removeItemData)).rejects.toThrow(rpcError);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const unexpectedError = new Error('Unexpected error');
      mockCartService.removeItem.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(controller.removeItem(removeItemData)).rejects.toThrow(
        InternalServerRpcException,
      );
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
    });
  });

  describe('clear', () => {
    it('should call CartService.clear and return result', async () => {
      // Arrange
      const clearData = { userId: 'user123' };
      const expectedResult = { success: true };
      mockCartService.clear.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.clear(clearData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCartService.clear).toHaveBeenCalledWith(clearData);
    });

    it('should re-throw RPC exceptions', async () => {
      // Arrange
      const clearData = { userId: 'user123' };
      const rpcError = new RpcException({ statusCode: 500, message: 'Database error' });
      mockCartService.clear.mockRejectedValue(rpcError);

      // Act & Assert
      await expect(controller.clear(clearData)).rejects.toThrow(rpcError);
      expect(mockCartService.clear).toHaveBeenCalledWith(clearData);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      const clearData = { userId: 'user123' };
      const unexpectedError = new Error('Unexpected error');
      mockCartService.clear.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(controller.clear(clearData)).rejects.toThrow(InternalServerRpcException);
      expect(mockCartService.clear).toHaveBeenCalledWith(clearData);
    });
  });

  describe('merge', () => {
    it('should call CartService.merge and return result', async () => {
      // Arrange
      const mergeData = {
        userId: 'user123',
        guestItems: [{ productId: 'product-123', quantity: 2 }],
      };
      const expectedResult = { cart: { id: 'cart-123', itemsCount: 1 } };
      mockCartService.merge.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.merge(mergeData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCartService.merge).toHaveBeenCalledWith(mergeData);
    });

    it('should re-throw RPC exceptions', async () => {
      // Arrange
      const mergeData = {
        userId: 'user123',
        guestItems: [{ productId: 'product-123', quantity: 2 }],
      };
      const rpcError = new RpcException({ statusCode: 400, message: 'Validation error' });
      mockCartService.merge.mockRejectedValue(rpcError);

      // Act & Assert
      await expect(controller.merge(mergeData)).rejects.toThrow(rpcError);
      expect(mockCartService.merge).toHaveBeenCalledWith(mergeData);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      const mergeData = {
        userId: 'user123',
        guestItems: [{ productId: 'product-123', quantity: 2 }],
      };
      const unexpectedError = new Error('Unexpected error');
      mockCartService.merge.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(controller.merge(mergeData)).rejects.toThrow(InternalServerRpcException);
      expect(mockCartService.merge).toHaveBeenCalledWith(mergeData);
    });
  });
});
