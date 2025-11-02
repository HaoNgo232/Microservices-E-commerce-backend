import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CartService } from './cart.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';
import { CartGetDto } from '@shared/dto/cart.dto';
import { ServiceUnavailableRpcException, InternalServerRpcException } from '@shared/exceptions/rpc-exceptions';

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
  let mockCartItemService: jest.Mocked<CartItemService>;
  let mockProductClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
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
      providers: [
        CartService,
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

    service = module.get<CartService>(CartService);
    mockPrisma = module.get(PrismaService);
    mockCartItemService = module.get(CartItemService);
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

    it('should throw ValidationRpcException when neither userId nor sessionId provided', async () => {
      // Act & Assert
      await expect(service.get({} as CartGetDto)).rejects.toThrow(InternalServerRpcException);
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
      const mockCartItem = {
        id: 'item-1',
        cartId: 'cart-123',
        productId: 'product-1',
        quantity: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.cart.create as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.addItem.mockResolvedValue(mockCartItem);

      // Act
      const result = await service.addItem({
        userId: 'user123',
        productId: 'product-1',
        quantity: 2,
      });

      // Assert
      expect(result).toEqual({ cartItem: mockCartItem });
      expect(mockPrisma.cart.create).toHaveBeenCalled();
      expect(mockCartItemService.addItem).toHaveBeenCalledWith('cart-123', 'product-1', 2);
    });

    it('should use existing cart if found', async () => {
      // Arrange
      const mockCartItem = {
        id: 'item-1',
        cartId: 'cart-123',
        productId: 'product-1',
        quantity: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.addItem.mockResolvedValue(mockCartItem);

      // Act
      const result = await service.addItem({
        userId: 'user123',
        productId: 'product-1',
        quantity: 2,
      });

      // Assert
      expect(result).toEqual({ cartItem: mockCartItem });
      expect(mockPrisma.cart.create).not.toHaveBeenCalled();
      expect(mockCartItemService.addItem).toHaveBeenCalledWith('cart-123', 'product-1', 2);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.addItem.mockRejectedValue(new InternalServerRpcException('Unexpected error'));

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
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.addItem.mockRejectedValue(new Error('Generic error'));

      // Act & Assert
      await expect(
        service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 2,
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('updateItem', () => {
    it('should update item quantity successfully', async () => {
      // Arrange
      const mockCartItem = {
        id: 'item-1',
        cartId: 'cart-123',
        productId: 'product-1',
        quantity: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.updateQuantity.mockResolvedValue(mockCartItem);

      // Act
      const result = await service.updateItem({
        userId: 'user123',
        productId: 'product-1',
        quantity: 5,
      });

      // Assert
      expect(result).toEqual({ cartItem: mockCartItem });
      expect(mockCartItemService.updateQuantity).toHaveBeenCalledWith('cart-123', 'product-1', 5);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.updateQuantity.mockRejectedValue(new InternalServerRpcException('Unexpected error'));

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
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.updateQuantity.mockRejectedValue(new Error('Generic error'));

      // Act & Assert
      await expect(
        service.updateItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 5,
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('removeItem', () => {
    it('should remove item successfully', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.removeItem.mockResolvedValue({ success: true });

      // Act
      const result = await service.removeItem({
        userId: 'user123',
        productId: 'product-1',
      });

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockCartItemService.removeItem).toHaveBeenCalledWith('cart-123', 'product-1');
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.removeItem.mockRejectedValue(new InternalServerRpcException('Unexpected error'));

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
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      mockCartItemService.removeItem.mockRejectedValue(new Error('Generic error'));

      // Act & Assert
      await expect(
        service.removeItem({
          userId: 'user123',
          productId: 'product-1',
        }),
      ).rejects.toThrow(InternalServerRpcException);
    });
  });
});
