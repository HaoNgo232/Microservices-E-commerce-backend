import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CartItemService } from './cart-item.service';
import { PrismaService } from '@cart-app/prisma/prisma.service';
import {
  ValidationRpcException,
  EntityNotFoundRpcException,
} from '@shared/exceptions/rpc-exceptions';

describe('CartItemService', () => {
  let service: CartItemService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockProductClient: jest.Mocked<ClientProxy>;

  const mockCartItem = {
    id: 'cart-item-123',
    cartId: 'cart-123',
    productId: 'product-123',
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: 'product-123',
    name: 'Test Product',
    priceInt: 10000,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      cartItem: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockProductAppClient = {
      getProductById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartItemService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ClientProxy,
          useValue: mockProductAppClient,
        },
      ],
    }).compile();

    service = module.get<CartItemService>(CartItemService);
    mockPrisma = module.get(PrismaService);
    mockProductClient = module.get(ClientProxy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addItem', () => {
    it('should create new CartItem if not exists', async () => {
      // Arrange
      mockProductClient.send.mockReturnValue(of(mockProduct));
      (mockPrisma.cartItem.upsert as jest.Mock).mockResolvedValue(mockCartItem);

      // Act
      const result = await service.addItem('cart-123', 'product-123', 2);

      // Assert
      expect(result).toEqual(mockCartItem);
      expect(mockProductClient.send).toHaveBeenCalledWith('product.getById', {
        id: 'product-123',
      });
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
      mockProductClient.send.mockReturnValue(of(mockProduct));
      const existingItem = { ...mockCartItem, quantity: 3 };
      (mockPrisma.cartItem.upsert as jest.Mock).mockResolvedValue(existingItem);

      // Act
      const result = await service.addItem('cart-123', 'product-123', 2);

      // Assert
      expect(result).toEqual(existingItem);
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

    it('should throw ValidationRpcException if quantity <= 0', async () => {
      // Act & Assert
      await expect(service.addItem('cart-123', 'product-123', 0)).rejects.toThrow(
        ValidationRpcException,
      );
      await expect(service.addItem('cart-123', 'product-123', -1)).rejects.toThrow(
        ValidationRpcException,
      );
      expect(mockProductClient.send).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundRpcException if product not found', async () => {
      // Arrange
      const notFoundError = new EntityNotFoundRpcException('Product', 'product-123');
      mockProductClient.send.mockReturnValue(throwError(() => notFoundError));

      // Act & Assert
      await expect(service.addItem('cart-123', 'product-123', 2)).rejects.toThrow(
        EntityNotFoundRpcException,
      );
      expect(mockProductClient.send).toHaveBeenCalledWith('product.getById', {
        id: 'product-123',
      });
      expect(mockPrisma.cartItem.upsert).not.toHaveBeenCalled();
    });
  });

  describe('updateQuantity', () => {
    it('should update quantity to new value', async () => {
      // Arrange
      const updatedItem = { ...mockCartItem, quantity: 5 };
      (mockPrisma.cartItem.findUnique as jest.Mock).mockResolvedValue(mockCartItem);
      (mockPrisma.cartItem.update as jest.Mock).mockResolvedValue(updatedItem);

      // Act
      const result = await service.updateQuantity('cart-123', 'product-123', 5);

      // Assert
      expect(result).toEqual(updatedItem);
      expect(mockPrisma.cartItem.findUnique).toHaveBeenCalledWith({
        where: {
          cartId_productId: { cartId: 'cart-123', productId: 'product-123' },
        },
      });
      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-123' },
        data: { quantity: 5 },
      });
    });

    it('should delete item if quantity = 0', async () => {
      // Arrange
      (mockPrisma.cartItem.findUnique as jest.Mock).mockResolvedValue(mockCartItem);
      (mockPrisma.cartItem.delete as jest.Mock).mockResolvedValue(mockCartItem);

      // Act
      const result = await service.updateQuantity('cart-123', 'product-123', 0);

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'cart-item-123' },
      });
      expect(mockPrisma.cartItem.update).not.toHaveBeenCalled();
    });

    it('should throw ValidationRpcException if quantity < 0', async () => {
      // Act & Assert
      await expect(service.updateQuantity('cart-123', 'product-123', -1)).rejects.toThrow(
        ValidationRpcException,
      );
      expect(mockPrisma.cartItem.findUnique).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundRpcException if item not found', async () => {
      // Arrange
      (mockPrisma.cartItem.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateQuantity('cart-123', 'product-123', 5)).rejects.toThrow(
        EntityNotFoundRpcException,
      );
      expect(mockPrisma.cartItem.findUnique).toHaveBeenCalledWith({
        where: {
          cartId_productId: { cartId: 'cart-123', productId: 'product-123' },
        },
      });
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
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: {
          cartId: 'cart-123',
          productId: 'product-123',
        },
      });
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
  });
});
