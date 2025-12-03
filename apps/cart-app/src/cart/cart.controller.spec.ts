import { Test, TestingModule } from '@nestjs/testing';
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

  beforeEach(async () => {
    const mockCartServiceInstance = {
      get: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
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

    it('should propagate errors from service', async () => {
      const error = new Error('Service error');
      mockCartService.get.mockRejectedValue(error);

      await expect(controller.get({ userId: 'user123' })).rejects.toThrow(error);
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });
  });

  describe('addItem', () => {
    it('should call CartService.addItem and return result', async () => {
      const addItemData = { userId: 'user123', productId: 'product-123', quantity: 2 };
      mockCartService.addItem.mockResolvedValue(mockCartData);

      const result = await controller.addItem(addItemData);

      expect(result).toEqual(mockCartData);
      expect(mockCartService.addItem).toHaveBeenCalledWith(addItemData);
    });

    it('should propagate errors from service', async () => {
      const addItemData = { userId: 'user123', productId: 'product-123', quantity: 2 };
      const error = new Error('Service error');
      mockCartService.addItem.mockRejectedValue(error);

      await expect(controller.addItem(addItemData)).rejects.toThrow(error);
      expect(mockCartService.addItem).toHaveBeenCalledWith(addItemData);
    });
  });

  describe('updateItem', () => {
    it('should call CartService.updateItem and return result', async () => {
      const updateItemData = { userId: 'user123', productId: 'product-123', quantity: 5 };
      mockCartService.updateItem.mockResolvedValue(mockCartData);

      const result = await controller.updateItem(updateItemData);

      expect(result).toEqual(mockCartData);
      expect(mockCartService.updateItem).toHaveBeenCalledWith(updateItemData);
    });

    it('should propagate errors from service', async () => {
      const updateItemData = { userId: 'user123', productId: 'product-123', quantity: 5 };
      const error = new Error('Service error');
      mockCartService.updateItem.mockRejectedValue(error);

      await expect(controller.updateItem(updateItemData)).rejects.toThrow(error);
      expect(mockCartService.updateItem).toHaveBeenCalledWith(updateItemData);
    });
  });

  describe('removeItem', () => {
    it('should call CartService.removeItem and return full cart', async () => {
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const expectedCartResult = {
        cart: mockCartData.cart,
        items: [],
        totalInt: 0,
      };
      mockCartService.removeItem.mockResolvedValue({ success: true });
      mockCartService.get.mockResolvedValue(expectedCartResult);

      const result = await controller.removeItem(removeItemData);

      expect(result).toEqual(expectedCartResult);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
      expect(mockCartService.get).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should propagate errors from service', async () => {
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const error = new Error('Service error');
      mockCartService.removeItem.mockRejectedValue(error);

      await expect(controller.removeItem(removeItemData)).rejects.toThrow(error);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
    });
  });
});
