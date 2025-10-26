import { Test, TestingModule } from '@nestjs/testing';
import { OrderItemService } from './order-item.service';
import { PrismaService } from '@order-app/prisma/prisma.service';
import {
  EntityNotFoundRpcException,
  InternalServerRpcException,
  ValidationRpcException,
} from '@shared/exceptions/rpc-exceptions';
import {
  OrderItemListByOrderDto,
  OrderItemAddDto,
  OrderItemRemoveDto,
} from '@shared/dto/order.dto';

describe('OrderItemService', () => {
  let service: OrderItemService;
  let prisma: {
    order: { findUnique: jest.Mock; update: jest.Mock };
    orderItem: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; delete: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const prismaServiceMock = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      orderItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderItemService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<OrderItemService>(OrderItemService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listByOrder', () => {
    it('should return order items sorted by creation date', async () => {
      const orderId = 'order-123';
      const mockItems = [
        {
          id: 'item-1',
          orderId,
          productId: 'prod-1',
          quantity: 2,
          priceInt: 1000,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'item-2',
          orderId,
          productId: 'prod-2',
          quantity: 1,
          priceInt: 2000,
          createdAt: new Date('2024-01-02'),
        },
      ];

      prisma.order.findUnique.mockResolvedValueOnce({ id: orderId });
      prisma.orderItem.findMany.mockResolvedValueOnce(mockItems);

      const result = await service.listByOrder({ orderId } as OrderItemListByOrderDto);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('item-1');
      expect(result[1].id).toBe('item-2');
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw EntityNotFoundRpcException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.listByOrder({ orderId: 'non-existent' } as OrderItemListByOrderDto),
      ).rejects.toThrow(EntityNotFoundRpcException);
    });

    it('should return empty array when order has no items', async () => {
      const orderId = 'order-123';

      prisma.order.findUnique.mockResolvedValueOnce({ id: orderId });
      prisma.orderItem.findMany.mockResolvedValueOnce([]);

      const result = await service.listByOrder({ orderId } as OrderItemListByOrderDto);

      expect(result).toEqual([]);
    });

    it('should call prisma with correct select on order check', async () => {
      const orderId = 'order-123';
      prisma.order.findUnique.mockResolvedValueOnce(null);

      try {
        await service.listByOrder({ orderId } as OrderItemListByOrderDto);
      } catch {
        // Expected to throw
      }

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: orderId },
        select: { id: true },
      });
    });
  });

  describe('addItem', () => {
    const validDto: OrderItemAddDto = {
      orderId: 'order-123',
      productId: 'prod-1',
      quantity: 2,
      priceInt: 1500,
    };

    it('should successfully add item to order and increment total', async () => {
      const mockOrderItem = {
        id: 'item-123',
        ...validDto,
        createdAt: new Date(),
      };

      const mockOrderUpdate = { id: validDto.orderId, totalInt: 3000 };

      prisma.order.findUnique.mockResolvedValueOnce({ id: validDto.orderId });
      prisma.orderItem.create.mockResolvedValueOnce(mockOrderItem);
      prisma.order.update.mockResolvedValueOnce(mockOrderUpdate);

      prisma.$transaction.mockImplementation(queries => {
        // For array-based transactions, return results
        if (Array.isArray(queries)) {
          return Promise.resolve([mockOrderItem, mockOrderUpdate]);
        }
        return Promise.resolve([mockOrderItem]);
      });

      const result = await service.addItem(validDto);

      expect(result).toEqual(mockOrderItem);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ValidationRpcException when quantity is zero', async () => {
      const invalidDto = { ...validDto, quantity: 0 };

      await expect(service.addItem(invalidDto)).rejects.toThrow(ValidationRpcException);
    });

    it('should throw ValidationRpcException when quantity is negative', async () => {
      const invalidDto = { ...validDto, quantity: -5 };

      await expect(service.addItem(invalidDto)).rejects.toThrow(ValidationRpcException);
    });

    it('should throw ValidationRpcException when priceInt is zero', async () => {
      const invalidDto = { ...validDto, priceInt: 0 };

      await expect(service.addItem(invalidDto)).rejects.toThrow(ValidationRpcException);
    });

    it('should throw ValidationRpcException when priceInt is negative', async () => {
      const invalidDto = { ...validDto, priceInt: -100 };

      await expect(service.addItem(invalidDto)).rejects.toThrow(ValidationRpcException);
    });

    it('should throw EntityNotFoundRpcException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(service.addItem(validDto)).rejects.toThrow(EntityNotFoundRpcException);
    });

    it('should throw InternalServerRpcException on database error', async () => {
      prisma.order.findUnique.mockResolvedValueOnce({ id: validDto.orderId });
      prisma.$transaction.mockRejectedValueOnce(new Error('Database error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.addItem(validDto)).rejects.toThrow(InternalServerRpcException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OrderItemService] addItem error:',
        expect.objectContaining({
          orderId: validDto.orderId,
          productId: validDto.productId,
          quantity: validDto.quantity,
          priceInt: validDto.priceInt,
        }),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should re-throw EntityNotFoundRpcException without wrapping', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(null);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.addItem(validDto)).rejects.toThrow(EntityNotFoundRpcException);

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should re-throw ValidationRpcException without wrapping', async () => {
      const invalidDto = { ...validDto, quantity: 0 };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.addItem(invalidDto)).rejects.toThrow(ValidationRpcException);

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('removeItem', () => {
    it('should successfully remove item and decrement order total', async () => {
      const itemId = 'item-123';
      const mockOrderItem = {
        id: itemId,
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1000,
        createdAt: new Date(),
        order: {
          id: 'order-123',
          totalInt: 5000,
        },
      };

      prisma.orderItem.findUnique.mockResolvedValueOnce(mockOrderItem);
      prisma.$transaction.mockResolvedValueOnce(undefined);

      await service.removeItem({ id: itemId } as OrderItemRemoveDto);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw EntityNotFoundRpcException when order item does not exist', async () => {
      prisma.orderItem.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.removeItem({ id: 'non-existent' } as OrderItemRemoveDto),
      ).rejects.toThrow(EntityNotFoundRpcException);
    });

    it('should not decrement order total below zero', async () => {
      const itemId = 'item-123';
      const mockOrderItem = {
        id: itemId,
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 10,
        priceInt: 1000,
        createdAt: new Date(),
        order: {
          id: 'order-123',
          totalInt: 500, // Less than item total (10 * 1000 = 10000)
        },
      };

      prisma.orderItem.findUnique.mockResolvedValueOnce(mockOrderItem);
      prisma.$transaction.mockResolvedValueOnce(undefined);

      await service.removeItem({ id: itemId } as OrderItemRemoveDto);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw InternalServerRpcException on database error', async () => {
      const itemId = 'item-123';
      const mockOrderItem = {
        id: itemId,
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1000,
        createdAt: new Date(),
        order: {
          id: 'order-123',
          totalInt: 5000,
        },
      };

      prisma.orderItem.findUnique.mockResolvedValueOnce(mockOrderItem);
      prisma.$transaction.mockRejectedValueOnce(new Error('Database error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.removeItem({ id: itemId } as OrderItemRemoveDto)).rejects.toThrow(
        InternalServerRpcException,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OrderItemService] removeItem error:',
        expect.objectContaining({
          orderItemId: itemId,
          orderId: 'order-123',
          totalAdjustment: 2000,
        }),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should re-throw EntityNotFoundRpcException without logging', async () => {
      prisma.orderItem.findUnique.mockResolvedValueOnce(null);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        service.removeItem({ id: 'non-existent' } as OrderItemRemoveDto),
      ).rejects.toThrow(EntityNotFoundRpcException);

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should calculate correct decrement value using Math.min', async () => {
      const itemId = 'item-123';
      const priceInt = 1000;
      const quantity = 5;
      const orderTotal = 3000;

      const mockOrderItem = {
        id: itemId,
        orderId: 'order-123',
        productId: 'prod-1',
        quantity,
        priceInt,
        createdAt: new Date(),
        order: {
          id: 'order-123',
          totalInt: orderTotal,
        },
      };

      prisma.orderItem.findUnique.mockResolvedValueOnce(mockOrderItem);
      prisma.$transaction.mockResolvedValueOnce(undefined);

      await service.removeItem({ id: itemId } as OrderItemRemoveDto);

      // Expected decrement value: Math.min(3000, 5000) = 3000
      const expectedDecrement = Math.min(orderTotal, priceInt * quantity);
      expect(expectedDecrement).toBe(3000);
    });

    it('should include order item id in findUnique query', async () => {
      const itemId = 'item-123';
      prisma.orderItem.findUnique.mockResolvedValueOnce(null);

      try {
        await service.removeItem({ id: itemId } as OrderItemRemoveDto);
      } catch {
        // Expected to throw
      }

      expect(prisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: itemId },
        include: {
          order: {
            select: {
              id: true,
              totalInt: true,
            },
          },
        },
      });
    });
  });

  describe('toOrderItemResponse (private method)', () => {
    it('should correctly map order item to response DTO', () => {
      const mockItem = {
        id: 'item-123',
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1500,
        createdAt: new Date('2024-01-01'),
      };

      const serviceInstance = service as unknown as {
        toOrderItemResponse: (item: typeof mockItem) => unknown;
      };
      const result = serviceInstance.toOrderItemResponse(mockItem);

      expect(result).toEqual({
        id: 'item-123',
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1500,
        createdAt: mockItem.createdAt,
      });
    });

    it('should preserve all fields in response mapping', () => {
      const createdDate = new Date('2024-06-15T10:30:00Z');
      const mockItem = {
        id: 'item-456',
        orderId: 'order-456',
        productId: 'prod-789',
        quantity: 5,
        priceInt: 2999,
        createdAt: createdDate,
      };

      const serviceInstance = service as unknown as {
        toOrderItemResponse: (item: typeof mockItem) => unknown;
      };
      const result = serviceInstance.toOrderItemResponse(mockItem);

      expect(result).toEqual({
        id: 'item-456',
        orderId: 'order-456',
        productId: 'prod-789',
        quantity: 5,
        priceInt: 2999,
        createdAt: createdDate,
      });
    });
  });
});
