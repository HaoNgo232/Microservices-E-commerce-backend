import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CartService } from './cart.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { CartGetDto } from '@shared/dto/cart.dto';
import {
  ServiceUnavailableRpcException,
  InternalServerRpcException,
  ValidationRpcException,
  EntityNotFoundRpcException,
} from '@shared/exceptions/rpc-exceptions';

const mockCart = {
  id: 'cart-123',
  sessionId: 'user-user123',
  userId: 'user123',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
};

const mockCartWithItems = {
  ...mockCart,
  items: [
    {
      id: 'item-1',
      cartId: 'cart-123',
      productId: 'product-1',
      quantity: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'item-2',
      cartId: 'cart-123',
      productId: 'product-2',
      quantity: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

const mockProducts = [
  {
    id: 'product-1',
    name: 'Product 1',
    priceInt: 10000,
  },
  {
    id: 'product-2',
    name: 'Product 2',
    priceInt: 20000,
  },
];

describe('CartService', () => {
  let service: CartService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockProductClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const mockPrismaService = {
      cart: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cartItem: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockClientProxy = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'PRODUCT_SERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    mockPrisma = module.get(PrismaService);
    mockProductClient = module.get('PRODUCT_SERVICE');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return cart with enriched product data when cart has items', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      mockProductClient.send.mockReturnValue(of(mockProducts));

      // Act
      const result = await service.get({ userId: 'user123' });

      // Assert
      expect(result.cart.items).toHaveLength(2);
      expect(result.items).toHaveLength(2);
      expect(result.totalInt).toBe(80000); // (2 * 10000) + (3 * 20000)
      expect(mockPrisma.cart.findUnique).toHaveBeenCalledWith({
        where: { sessionId: 'user-user123' },
        include: { items: true },
      });
      expect(mockProductClient.send).toHaveBeenCalledWith('product.getByIds', {
        ids: ['product-1', 'product-2'],
      });
    });

    it('should create new cart if not found', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.cart.create as jest.Mock).mockResolvedValue(mockCart);

      // Act
      const result = await service.get({ userId: 'user123' });

      // Assert
      expect(result.cart).toEqual(mockCart);
      expect(result.totalInt).toBe(0);
      expect(result.items).toEqual([]);
      expect(mockPrisma.cart.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'user-user123',
          userId: 'user123',
        },
        include: { items: true },
      });
    });

    it('should return empty cart with totalInt = 0 when no items', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);

      // Act
      const result = await service.get({ userId: 'user123' });

      // Assert
      expect(result.cart).toEqual(mockCart);
      expect(result.totalInt).toBe(0);
      expect(result.items).toEqual([]);
      expect(mockProductClient.send).not.toHaveBeenCalled();
    });

    it('should handle product not found gracefully', async () => {
      // Arrange
      const cartWithOneItem = {
        ...mockCart,
        items: [mockCartWithItems.items[0]],
      };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(cartWithOneItem);
      mockProductClient.send.mockReturnValue(of([mockProducts[0]]));

      // Act
      const result = await service.get({ userId: 'user123' });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.totalInt).toBe(20000); // 2 * 10000
    });

    it('should throw ServiceUnavailableRpcException on product service timeout', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      mockProductClient.send.mockReturnValue(throwError(() => timeoutError));

      // Act & Assert
      await expect(service.get({ userId: 'user123' })).rejects.toThrow(ServiceUnavailableRpcException);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.get({ userId: 'user123' })).rejects.toThrow(InternalServerRpcException);
    });

    it('should handle error in get when fetchProductsByIds fails with non-RpcException', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      // Simulate a generic error (not RpcException) from product service
      mockProductClient.send.mockReturnValue(throwError(() => new Error('Network error')));

      // Act & Assert
      await expect(service.get({ userId: 'user123' })).rejects.toThrow(InternalServerRpcException);
    });

    it('should update cart with userId if cart exists without userId', async () => {
      // Arrange
      const cartWithoutUserId = { ...mockCart, userId: null };
      const cartWithUserId = { ...mockCart, userId: 'user123' };

      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(cartWithoutUserId);
      (mockPrisma.cart.update as jest.Mock).mockResolvedValue(cartWithUserId);

      // Act
      const result = await service.get({ userId: 'user123' });

      // Assert
      expect(mockPrisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-123' },
        data: { userId: 'user123' },
        include: { items: true },
      });
      expect(result.cart.userId).toBe('user123');
    });

    it('should throw InternalServerRpcException when neither userId nor sessionId provided', async () => {
      // Act & Assert
      // getOrCreateCart throws ValidationRpcException but get() wraps it in InternalServerRpcException
      await expect(service.get({} as CartGetDto)).rejects.toThrow(InternalServerRpcException);
      await expect(service.get({} as CartGetDto)).rejects.toThrow('Lỗi khi lấy thông tin giỏ hàng');
    });

    it('should handle non-array products response', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      mockProductClient.send.mockReturnValue(of({ invalid: 'response' }));

      // Act & Assert
      await expect(service.get({ userId: 'user123' })).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('addItem', () => {
    it('should create cart and add item successfully', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // getOrCreateCart: cart not found
        .mockResolvedValueOnce(mockCart); // get() call after addItem
      (mockPrisma.cart.create as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.cartItem.upsert as jest.Mock).mockResolvedValue({});
      mockProductClient.send.mockReturnValue(of([]));

      // Act
      const result = await service.addItem({
        userId: 'user123',
        productId: 'product-1',
        quantity: 2,
      });

      // Assert
      expect(result).toHaveProperty('cart');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalInt');
      expect(mockPrisma.cart.create).toHaveBeenCalled();
    });

    it('should use existing cart if found', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockCart) // getOrCreateCart: cart found
        .mockResolvedValueOnce(mockCart); // get() call after addItem
      (mockPrisma.cartItem.upsert as jest.Mock).mockResolvedValue({});
      mockProductClient.send.mockReturnValue(of([]));

      // Act
      const result = await service.addItem({
        userId: 'user123',
        productId: 'product-1',
        quantity: 2,
      });

      // Assert
      expect(result).toHaveProperty('cart');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalInt');
      expect(mockPrisma.cart.create).not.toHaveBeenCalled();
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.cartItem.upsert as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 2,
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });

    it('should handle generic error during addItem', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 2,
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });

    it('should throw ValidationRpcException when quantity is 0 or negative', async () => {
      // Act & Assert
      await expect(
        service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 0,
        }),
      ).rejects.toThrow(ValidationRpcException);
      await expect(
        service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 0,
        }),
      ).rejects.toThrow('Số lượng phải lớn hơn 0');

      await expect(
        service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: -1,
        }),
      ).rejects.toThrow(ValidationRpcException);
      await expect(
        service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: -1,
        }),
      ).rejects.toThrow('Số lượng phải lớn hơn 0');
    });
  });

  describe('updateItem', () => {
    it('should update item quantity successfully', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockCart) // getOrCreateCart: cart found
        .mockResolvedValueOnce(mockCart); // get() call after updateItem
      (mockPrisma.cartItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      mockProductClient.send.mockReturnValue(of([]));

      // Act
      const result = await service.updateItem({
        userId: 'user123',
        productId: 'product-1',
        quantity: 5,
      });

      // Assert
      expect(result).toHaveProperty('cart');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalInt');
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.cartItem.updateMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.updateItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 5,
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });

    it('should handle generic error during updateItem', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.updateItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 5,
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });

    it('should throw ValidationRpcException when quantity is negative', async () => {
      // Act & Assert
      await expect(
        service.updateItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: -1,
        }),
      ).rejects.toThrow(ValidationRpcException);
      await expect(
        service.updateItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: -1,
        }),
      ).rejects.toThrow('Số lượng không hợp lệ');
    });

    it('should delete item when quantity is 0', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockCart) // getOrCreateCart
        .mockResolvedValueOnce(mockCart); // get() after update
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      mockProductClient.send.mockReturnValue(of([]));

      // Act
      await service.updateItem({
        userId: 'user123',
        productId: 'product-1',
        quantity: 0,
      });

      // Assert
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123', productId: 'product-1' },
      });
      expect(mockPrisma.cartItem.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('should remove item successfully', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      // Act
      const result = await service.removeItem({
        userId: 'user123',
        productId: 'product-1',
      });

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123', productId: 'product-1' },
      });
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.removeItem({
          userId: 'user123',
          productId: 'product-1',
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });

    it('should handle generic error during removeItem', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.removeItem({
          userId: 'user123',
          productId: 'product-1',
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('clear', () => {
    it('should clear all items from cart successfully', async () => {
      // Arrange
      (mockPrisma.cart.findFirst as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      // Act
      const result = await service.clear('user123');

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockPrisma.cart.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user123' },
      });
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123' },
      });
    });

    it('should throw EntityNotFoundRpcException when cart not found', async () => {
      // Arrange
      (mockPrisma.cart.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.clear('non-existent')).rejects.toThrow(EntityNotFoundRpcException);
      await expect(service.clear('non-existent')).rejects.toThrow('Cart');
    });

    it('should handle non-RpcException errors', async () => {
      // Arrange
      (mockPrisma.cart.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.clear('user123')).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('enrichCartItems', () => {
    it('should handle missing products gracefully', async () => {
      // Arrange
      const cartWithItem = {
        ...mockCart,
        items: [mockCartWithItems.items[0]],
      };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(cartWithItem);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockProductClient.send.mockReturnValue(of([])); // No products returned

      // Act
      const result = await service.get({ userId: 'user123' });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].product).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[CartService] Product not found:', 'product-1');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total correctly when some products are missing', async () => {
      // Arrange
      const cartWithItems = {
        ...mockCart,
        items: [
          { ...mockCartWithItems.items[0], productId: 'product-1' },
          { ...mockCartWithItems.items[1], productId: 'product-missing' },
        ],
      };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(cartWithItems);
      // Only return product-1, product-missing is missing
      mockProductClient.send.mockReturnValue(of([mockProducts[0]]));

      // Act
      const result = await service.get({ userId: 'user123' });

      // Assert
      // Should only calculate for product-1: 2 * 10000 = 20000
      // product-missing should be ignored (0 contribution)
      expect(result.totalInt).toBe(20000);
    });
  });

  describe('fetchProductsByIds error handling', () => {
    it('should handle ServiceUnavailableRpcException from product service', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      const serviceError = new ServiceUnavailableRpcException('Product service unavailable');
      mockProductClient.send.mockReturnValue(throwError(() => serviceError));

      // Act & Assert
      await expect(service.get({ userId: 'user123' })).rejects.toThrow(ServiceUnavailableRpcException);
    });

    it('should handle InternalServerRpcException from product service', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      const internalError = new InternalServerRpcException('Product service error');
      mockProductClient.send.mockReturnValue(throwError(() => internalError));

      // Act & Assert
      await expect(service.get({ userId: 'user123' })).rejects.toThrow(InternalServerRpcException);
    });

    it('should handle generic errors from product service', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      mockProductClient.send.mockReturnValue(throwError(() => new Error('Network error')));

      // Act & Assert
      await expect(service.get({ userId: 'user123' })).rejects.toThrow(InternalServerRpcException);
    });
  });
});
