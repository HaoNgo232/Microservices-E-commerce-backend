/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { CartService } from './cart.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import { CartItemService } from '@cart-app/cart-item/cart-item.service';

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
      },
      cartItem: {
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
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

  describe('getOrCreateCart', () => {
    it('should return existing cart if found', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);

      // Act
      const result = await service.getOrCreateCart('user123');

      // Assert
      expect(result).toEqual(mockCartWithItems);
      expect(mockPrisma.cart.findUnique).toHaveBeenCalledWith({
        where: { sessionId: 'user-user123' },
        include: { items: true },
      });
      expect(mockPrisma.cart.create).not.toHaveBeenCalled();
    });

    it('should create new cart if not found', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.cart.create as jest.Mock).mockResolvedValue(mockCart);

      // Act
      const result = await service.getOrCreateCart('user123');

      // Assert
      expect(result).toEqual(mockCart);
      expect(mockPrisma.cart.findUnique).toHaveBeenCalledWith({
        where: { sessionId: 'user-user123' },
        include: { items: true },
      });
      expect(mockPrisma.cart.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'user-user123',
          userId: 'user123',
        },
        include: { items: true },
      });
    });
  });

  describe('getCartWithProducts', () => {
    it('should return cart with enriched product data', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCartWithItems);
      mockProductClient.send.mockReturnValue(of(mockProducts));

      // Act
      const result = await service.getCartWithProducts('user123');

      // Assert
      expect(result.cart.items).toHaveLength(2);
      expect(result.cart.items[0].productId).toEqual(mockProducts[0]);
      expect(result.cart.items[1].productId).toEqual(mockProducts[1]);
      expect(result.totalInt).toBe(80000); // (2 * 10000) + (3 * 20000)
      expect(mockProductClient.send).toHaveBeenCalledWith('product.getByIds', {
        ids: ['product-1', 'product-2'],
      });
    });

    it('should handle product not found gracefully', async () => {
      // Arrange
      const cartWithOneItem = {
        ...mockCartWithItems,
        items: [mockCartWithItems.items[0]], // Only product-1
      };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(cartWithOneItem);
      mockProductClient.send.mockReturnValue(of([mockProducts[0]])); // Only product-1 found

      // Act
      const result = await service.getCartWithProducts('user123');

      // Assert
      expect(result.cart.items).toHaveLength(1);
      expect(result.cart.items[0].productId).toEqual(mockProducts[0]);
      expect(result.totalInt).toBe(20000); // 2 * 10000
    });

    it('should return empty cart with totalInt = 0', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);

      // Act
      const result = await service.getCartWithProducts('user123');

      // Assert
      expect(result.cart).toEqual(mockCart);
      expect(result.totalInt).toBe(0);
      expect(mockProductClient.send).not.toHaveBeenCalled();
    });
  });

  describe('clearCart', () => {
    it('should delete all items from cart', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

      // Act
      const result = await service.clearCart('user123');

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockPrisma.cart.findUnique).toHaveBeenCalledWith({
        where: { sessionId: 'user-user123' },
      });
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123' },
      });
    });

    it('should be idempotent if cart not found', async () => {
      // Arrange
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.clearCart('user123');

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('mergeGuestItems', () => {
    it('should add new items from guest cart', async () => {
      // Arrange
      const guestItems = [{ productId: 'product-1', quantity: 2 }];
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return await callback({
          cartItem: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      // Act
      const result = await service.mergeGuestItems('user123', guestItems);

      // Assert
      expect(result.cart.id).toBe('cart-123');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should merge duplicate items (add quantities)', async () => {
      // Arrange
      const guestItems = [{ productId: 'product-1', quantity: 2 }];
      const existingItem = { id: 'item-1', quantity: 3 };
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return await callback({
          cartItem: {
            findUnique: jest.fn().mockResolvedValue(existingItem),
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      // Act
      const result = await service.mergeGuestItems('user123', guestItems);

      // Assert
      expect(result.cart.id).toBe('cart-123');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should skip items with quantity <= 0', async () => {
      // Arrange
      const guestItems = [
        { productId: 'product-1', quantity: 0 },
        { productId: 'product-2', quantity: -1 },
      ];
      (mockPrisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return await callback({
          cartItem: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        });
      });

      // Act
      const result = await service.mergeGuestItems('user123', guestItems);

      // Assert
      expect(result.cart.id).toBe('cart-123');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Controller methods', () => {
    describe('get', () => {
      it('should call getCartWithProducts', async () => {
        // Arrange
        const mockResult = { cart: mockCart, totalInt: 0, items: [] };
        jest.spyOn(service, 'getCartWithProducts').mockResolvedValue(mockResult);

        // Act
        const result = await service.get({ userId: 'user123' });

        // Assert
        expect(result).toEqual(mockResult);
        expect(service.getCartWithProducts).toHaveBeenCalledWith('user123');
      });
    });

    describe('addItem', () => {
      it('should call getOrCreateCart and cartItemService.addItem', async () => {
        // Arrange
        const mockCartItem = {
          id: 'item-1',
          cartId: 'cart-123',
          productId: 'product-1',
          quantity: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        jest.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCart);
        mockCartItemService.addItem.mockResolvedValue(mockCartItem);

        // Act
        const result = await service.addItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 2,
        });

        // Assert
        expect(result).toEqual({ cartItem: mockCartItem });
        expect(service.getOrCreateCart).toHaveBeenCalledWith('user123');
        expect(mockCartItemService.addItem).toHaveBeenCalledWith('cart-123', 'product-1', 2);
      });
    });

    describe('updateItem', () => {
      it('should call getOrCreateCart and cartItemService.updateQuantity', async () => {
        // Arrange
        const mockCartItem = {
          id: 'item-1',
          cartId: 'cart-123',
          productId: 'product-1',
          quantity: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        jest.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCart);
        mockCartItemService.updateQuantity.mockResolvedValue(mockCartItem);

        // Act
        const result = await service.updateItem({
          userId: 'user123',
          productId: 'product-1',
          quantity: 5,
        });

        // Assert
        expect(result).toEqual({ cartItem: mockCartItem });
        expect(service.getOrCreateCart).toHaveBeenCalledWith('user123');
        expect(mockCartItemService.updateQuantity).toHaveBeenCalledWith('cart-123', 'product-1', 5);
      });
    });

    describe('removeItem', () => {
      it('should call getOrCreateCart and cartItemService.removeItem', async () => {
        // Arrange
        jest.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCart);
        mockCartItemService.removeItem.mockResolvedValue({ success: true });

        // Act
        const result = await service.removeItem({
          userId: 'user123',
          productId: 'product-1',
        });

        // Assert
        expect(result).toEqual({ success: true });
        expect(service.getOrCreateCart).toHaveBeenCalledWith('user123');
        expect(mockCartItemService.removeItem).toHaveBeenCalledWith('cart-123', 'product-1');
      });
    });

    describe('clear', () => {
      it('should call clearCart', async () => {
        // Arrange
        jest.spyOn(service, 'clearCart').mockResolvedValue({ success: true });

        // Act
        const result = await service.clear({ userId: 'user123' });

        // Assert
        expect(result).toEqual({ success: true });
        expect(service.clearCart).toHaveBeenCalledWith('user123');
      });
    });

    describe('merge', () => {
      it('should call mergeGuestItems', async () => {
        // Arrange
        const guestItems = [{ productId: 'product-1', quantity: 2 }];
        const mockResult = { cart: { id: 'cart-123', itemsCount: 1 } };
        jest.spyOn(service, 'mergeGuestItems').mockResolvedValue(mockResult);

        // Act
        const result = await service.merge({
          userId: 'user123',
          guestItems,
        });

        // Assert
        expect(result).toEqual(mockResult);
        expect(service.mergeGuestItems).toHaveBeenCalledWith('user123', guestItems);
      });
    });
  });
});
