import { Test, TestingModule } from '@nestjs/testing';
import { CartItemService } from './cart-item.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import {
  ValidationRpcException,
  EntityNotFoundRpcException,
  InternalServerRpcException,
} from '@shared/exceptions/rpc-exceptions';

describe('CartItemService', () => {
  let service: CartItemService;
  let mockPrisma: jest.Mocked<PrismaService>;

  const mockCartItem = {
    id: 'cart-item-123',
    cartId: 'cart-123',
    productId: 'product-123',
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      cartItem: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartItemService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CartItemService>(CartItemService);
    mockPrisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addItem', () => {
    it('should create new CartItem if not exists', async () => {
      // Arrange
      (mockPrisma.cartItem.upsert as jest.Mock).mockResolvedValue(mockCartItem);

      // Act
      const result = await service.addItem('cart-123', 'product-123', 2);

      // Assert
      expect(result).toEqual(mockCartItem);
      expect(mockPrisma.cartItem.upsert).toHaveBeenCalledWith({
        where: {
          cartId_productId: { cartId: 'cart-123', productId: 'product-123' },
        },
        update: {
          quantity: { increment: 2 },
        },
        create: {
          cartId: 'cart-123',
          productId: 'product-123',
          quantity: 2,
        },
      });
    });

    it('should increment quantity if item already exists', async () => {
      // Arrange
      const existingItem = { ...mockCartItem, quantity: 5 };
      (mockPrisma.cartItem.upsert as jest.Mock).mockResolvedValue(existingItem);

      // Act
      const result = await service.addItem('cart-123', 'product-123', 2);

      // Assert
      expect(result.quantity).toBe(5);
      expect(mockPrisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { quantity: { increment: 2 } },
        }),
      );
    });

    it('should throw ValidationRpcException if quantity <= 0', async () => {
      // Act & Assert
      await expect(service.addItem('cart-123', 'product-123', 0)).rejects.toThrow(ValidationRpcException);
      await expect(service.addItem('cart-123', 'product-123', -1)).rejects.toThrow(ValidationRpcException);
      expect(mockPrisma.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('should wrap unexpected database errors', async () => {
      // Arrange
      (mockPrisma.cartItem.upsert as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.addItem('cart-123', 'product-123', 2)).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('updateQuantity', () => {
    it('should update quantity to new value', async () => {
      // Arrange
      const updatedItem = { ...mockCartItem, quantity: 5 };
      (mockPrisma.cartItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.cartItem.findUnique as jest.Mock).mockResolvedValue(updatedItem);

      // Act
      const result = await service.updateQuantity('cart-123', 'product-123', 5);

      // Assert
      expect(result).toEqual(updatedItem);
      expect(mockPrisma.cartItem.updateMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123', productId: 'product-123' },
        data: { quantity: 5 },
      });
    });

    it('should delete item if quantity = 0', async () => {
      // Arrange
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      // Act
      const result = await service.updateQuantity('cart-123', 'product-123', 0);

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123', productId: 'product-123' },
      });
    });

    it('should throw ValidationRpcException if quantity < 0', async () => {
      // Act & Assert
      await expect(service.updateQuantity('cart-123', 'product-123', -1)).rejects.toThrow(ValidationRpcException);
      expect(mockPrisma.cartItem.updateMany).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundRpcException if item not found', async () => {
      // Arrange
      (mockPrisma.cartItem.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      // Act & Assert
      await expect(service.updateQuantity('cart-123', 'product-123', 5)).rejects.toThrow(EntityNotFoundRpcException);
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cartItem.updateMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.updateQuantity('cart-123', 'product-123', 5)).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('removeItem', () => {
    it('should delete item if exists', async () => {
      // Arrange
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      // Act
      const result = await service.removeItem('cart-123', 'product-123');

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: {
          cartId: 'cart-123',
          productId: 'product-123',
        },
      });
    });

    it('should be idempotent if item not exists', async () => {
      // Arrange
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      // Act
      const result = await service.removeItem('cart-123', 'product-123');

      // Assert
      expect(result).toEqual({ success: true });
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cartItem.deleteMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.removeItem('cart-123', 'product-123')).rejects.toThrow(InternalServerRpcException);
    });
  });

  describe('findByCartAndProduct', () => {
    it('should return cart item if found', async () => {
      // Arrange
      (mockPrisma.cartItem.findUnique as jest.Mock).mockResolvedValue(mockCartItem);

      // Act
      const result = await service.findByCartAndProduct('cart-123', 'product-123');

      // Assert
      expect(result).toEqual(mockCartItem);
      expect(mockPrisma.cartItem.findUnique).toHaveBeenCalledWith({
        where: {
          cartId_productId: { cartId: 'cart-123', productId: 'product-123' },
        },
      });
    });

    it('should return null if not found', async () => {
      // Arrange
      (mockPrisma.cartItem.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.findByCartAndProduct('cart-123', 'product-123');

      // Assert
      expect(result).toBeNull();
    });

    it('should wrap unexpected errors', async () => {
      // Arrange
      (mockPrisma.cartItem.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.findByCartAndProduct('cart-123', 'product-123')).rejects.toThrow(InternalServerRpcException);
    });
  });
});
