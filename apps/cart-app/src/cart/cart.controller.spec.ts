import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';
import { ClientProxy } from '@nestjs/microservices';

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

    const mockPrismaService = {
      cart: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockCartItemServiceInstance = {
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
    };

    const mockClientProxy = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        {
          provide: CartService,
          useValue: mockCartServiceInstance,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CartItemService,
          useValue: mockCartItemServiceInstance,
        },
        {
          provide: 'PRODUCT_SERVICE',
          useValue: mockClientProxy,
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
      const expectedResult = { cartItem: mockCartItem };
      mockCartService.addItem.mockResolvedValue(expectedResult);

      const result = await controller.addItem(addItemData);

      expect(result).toEqual(expectedResult);
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
      const expectedResult = { cartItem: { ...mockCartItem, quantity: 5 } };
      mockCartService.updateItem.mockResolvedValue(expectedResult);

      const result = await controller.updateItem(updateItemData);

      expect(result).toEqual(expectedResult);
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
    it('should call CartService.removeItem and return result', async () => {
      const removeItemData = { userId: 'user123', productId: 'product-123' };
      const expectedResult = { success: true };
      mockCartService.removeItem.mockResolvedValue(expectedResult);

      const result = await controller.removeItem(removeItemData);

      expect(result).toEqual(expectedResult);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(removeItemData);
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
