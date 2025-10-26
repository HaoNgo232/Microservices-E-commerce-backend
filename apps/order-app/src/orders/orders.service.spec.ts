import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { PrismaService } from '@order-app/prisma/prisma.service';
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
  ConflictRpcException,
} from '@shared/exceptions/rpc-exceptions';
import {
  OrderCreateDto,
  OrderIdDto,
  OrderListByUserDto,
  OrderUpdateStatusDto,
  OrderCancelDto,
} from '@shared/dto/order.dto';
import { of, throwError } from 'rxjs';
import { EVENTS } from '@shared/events';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };
  let productClient: {
    send: jest.Mock;
  };
  let cartClient: {
    send: jest.Mock;
  };

  const mockOrder = {
    id: 'order-123',
    userId: 'user-123',
    addressId: 'addr-123',
    status: 'PENDING',
    totalInt: 3000,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    items: [
      {
        id: 'item-1',
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1000,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'item-2',
        orderId: 'order-123',
        productId: 'prod-2',
        quantity: 1,
        priceInt: 1000,
        createdAt: new Date('2024-01-01'),
      },
    ],
  };

  const mockProducts = [
    {
      id: 'prod-1',
      sku: 'SKU001',
      name: 'Product 1',
      slug: 'product-1',
      priceInt: 1000,
      stock: 10,
      description: 'Test product 1',
      imageUrls: ['image1.jpg'],
      categoryId: 'cat-1',
      attributes: {},
      model3dUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-2',
      sku: 'SKU002',
      name: 'Product 2',
      slug: 'product-2',
      priceInt: 1000,
      stock: 5,
      description: 'Test product 2',
      imageUrls: ['image2.jpg'],
      categoryId: 'cat-1',
      attributes: {},
      model3dUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const prismaMock = {
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const productClientMock = {
      send: jest.fn(),
    };

    const cartClientMock = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: 'PRODUCT_SERVICE',
          useValue: productClientMock,
        },
        {
          provide: 'CART_SERVICE',
          useValue: cartClientMock,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get(PrismaService);
    productClient = module.get('PRODUCT_SERVICE');
    cartClient = module.get('CART_SERVICE');

    productClient.send.mockImplementation(pattern => {
      if (pattern === EVENTS.PRODUCT.GET_BY_IDS) {
        return of(mockProducts);
      }
      return of({ success: true });
    });
    cartClient.send.mockReturnValue(of({ success: true }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validDto: OrderCreateDto = {
      userId: 'user-123',
      addressId: 'addr-123',
      items: [
        { productId: 'prod-1', quantity: 2, priceInt: 1000 },
        { productId: 'prod-2', quantity: 1, priceInt: 1000 },
      ],
    };

    it('should create order successfully with valid items', async () => {
      productClient.send.mockReturnValue(of(mockProducts));
      prisma.order.create.mockResolvedValue(mockOrder);

      const result = await service.create(validDto);

      expect(result).toEqual({
        id: mockOrder.id,
        userId: mockOrder.userId,
        addressId: mockOrder.addressId,
        status: mockOrder.status,
        totalInt: mockOrder.totalInt,
        items: mockOrder.items.map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          priceInt: item.priceInt,
          createdAt: item.createdAt,
        })),
        createdAt: mockOrder.createdAt,
        updatedAt: mockOrder.updatedAt,
      });

      expect(productClient.send).toHaveBeenCalledWith(EVENTS.PRODUCT.GET_BY_IDS, {
        ids: ['prod-1', 'prod-2'],
      });
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: {
          userId: validDto.userId,
          addressId: validDto.addressId,
          status: 'PENDING',
          totalInt: 3000,
          items: {
            create: validDto.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              priceInt: item.priceInt,
            })),
          },
        },
        include: {
          items: true,
        },
      });
    });

    it('should throw ValidationRpcException when items array is empty', async () => {
      const emptyDto = { ...validDto, items: [] };

      await expect(service.create(emptyDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.create(emptyDto)).rejects.toThrow(
        'Order must contain at least one item',
      );
    });

    it('should throw ValidationRpcException when items is undefined', async () => {
      const noItemsDto = { ...validDto, items: undefined as unknown as typeof validDto.items };

      await expect(service.create(noItemsDto)).rejects.toThrow(ValidationRpcException);
    });

    it('should throw ValidationRpcException when product not found', async () => {
      productClient.send.mockReturnValue(of([mockProducts[0]]));

      await expect(service.create(validDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.create(validDto)).rejects.toThrow('Products not found: prod-2');
    });

    it('should throw ValidationRpcException when insufficient stock', async () => {
      const lowStockProducts = [
        { ...mockProducts[0], stock: 1 },
        { ...mockProducts[1], stock: 5 },
      ];
      productClient.send.mockReturnValue(of(lowStockProducts));

      await expect(service.create(validDto)).rejects.toThrow(ValidationRpcException);
      await expect(service.create(validDto)).rejects.toThrow('Insufficient stock');
    });

    it('should calculate total correctly from items', async () => {
      productClient.send.mockReturnValue(of(mockProducts));
      prisma.order.create.mockResolvedValue(mockOrder);

      await service.create(validDto);

      const expectedTotal = validDto.items.reduce(
        (sum, item) => sum + item.priceInt * item.quantity,
        0,
      );
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalInt: expectedTotal,
          }),
        }),
      );
    });

    it('should decrement product stock after order creation', async () => {
      productClient.send.mockReturnValue(of(mockProducts));
      prisma.order.create.mockResolvedValue(mockOrder);

      await service.create(validDto);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(productClient.send).toHaveBeenCalledWith(EVENTS.PRODUCT.DEC_STOCK, {
        productId: 'prod-1',
        quantity: 2,
      });
      expect(productClient.send).toHaveBeenCalledWith(EVENTS.PRODUCT.DEC_STOCK, {
        productId: 'prod-2',
        quantity: 1,
      });
    });

    it('should clear user cart after order creation', async () => {
      productClient.send.mockReturnValue(of(mockProducts));
      prisma.order.create.mockResolvedValue(mockOrder);
      cartClient.send.mockReturnValue(of({ success: true }));

      await service.create(validDto);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cartClient.send).toHaveBeenCalledWith(EVENTS.CART.CLEAR, {
        userId: validDto.userId,
      });
    });

    it('should handle product service timeout', async () => {
      productClient.send.mockReturnValue(throwError(() => new Error('timeout of 5000ms exceeded')));

      await expect(service.create(validDto)).rejects.toThrow(ValidationRpcException);
    });

    it('should create order without addressId', async () => {
      const dtoWithoutAddress = { ...validDto, addressId: undefined };
      const orderWithoutAddress = { ...mockOrder, addressId: null };

      productClient.send.mockReturnValue(of(mockProducts));
      prisma.order.create.mockResolvedValue(orderWithoutAddress);

      const result = await service.create(dtoWithoutAddress);

      expect(result.addressId).toBeNull();
    });
  });

  describe('get', () => {
    it('should return order by id', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.get({ id: 'order-123' } as OrderIdDto);

      expect(result).toEqual({
        id: mockOrder.id,
        userId: mockOrder.userId,
        addressId: mockOrder.addressId,
        status: mockOrder.status,
        totalInt: mockOrder.totalInt,
        items: mockOrder.items.map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          priceInt: item.priceInt,
          createdAt: item.createdAt,
        })),
        createdAt: mockOrder.createdAt,
        updatedAt: mockOrder.updatedAt,
      });

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        include: { items: true },
      });
    });

    it('should throw EntityNotFoundRpcException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.get({ id: 'non-existent' } as OrderIdDto)).rejects.toThrow(
        EntityNotFoundRpcException,
      );
    });
  });

  describe('listByUser', () => {
    const mockOrders = [
      mockOrder,
      {
        ...mockOrder,
        id: 'order-456',
        createdAt: new Date('2024-01-02'),
      },
    ];

    it('should return paginated orders for user', async () => {
      const dto: OrderListByUserDto = {
        userId: 'user-123',
        page: 1,
        pageSize: 10,
      };

      prisma.order.count.mockResolvedValue(2);
      prisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.listByUser(dto);

      expect(result).toEqual({
        orders: mockOrders.map(order => ({
          id: order.id,
          userId: order.userId,
          addressId: order.addressId,
          status: order.status,
          totalInt: order.totalInt,
          items: order.items.map(item => ({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            quantity: item.quantity,
            priceInt: item.priceInt,
            createdAt: item.createdAt,
          })),
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })),
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should use default pagination values', async () => {
      const dto: OrderListByUserDto = {
        userId: 'user-123',
      };

      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockResolvedValue([]);

      await service.listByUser(dto);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should calculate correct skip value for pagination', async () => {
      const dto: OrderListByUserDto = {
        userId: 'user-123',
        page: 3,
        pageSize: 5,
      };

      prisma.order.count.mockResolvedValue(15);
      prisma.order.findMany.mockResolvedValue([]);

      await service.listByUser(dto);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should return empty array when user has no orders', async () => {
      const dto: OrderListByUserDto = {
        userId: 'user-no-orders',
        page: 1,
        pageSize: 10,
      };

      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.listByUser(dto);

      expect(result.orders).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('updateStatus', () => {
    it('should update order status from PENDING to PAID', async () => {
      const dto: OrderUpdateStatusDto = {
        id: 'order-123',
        status: 'PAID',
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
        updatedAt: new Date('2024-01-02'),
      });

      const result = await service.updateStatus(dto);

      expect(result.status).toBe('PAID');
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          status: 'PAID',
          updatedAt: expect.any(Date),
        },
        include: { items: true },
      });
    });

    it('should throw EntityNotFoundRpcException when order not found', async () => {
      const dto: OrderUpdateStatusDto = {
        id: 'non-existent',
        status: 'PAID',
      };

      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus(dto)).rejects.toThrow(EntityNotFoundRpcException);
    });

    it('should throw ValidationRpcException for invalid status transition', async () => {
      const dto: OrderUpdateStatusDto = {
        id: 'order-123',
        status: 'PENDING',
      };

      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'SHIPPED',
      });

      await expect(service.updateStatus(dto)).rejects.toThrow(ValidationRpcException);
      await expect(service.updateStatus(dto)).rejects.toThrow(
        'Invalid status transition from SHIPPED to PENDING',
      );
    });

    it('should restore stock when status changed to CANCELLED', async () => {
      const dto: OrderUpdateStatusDto = {
        id: 'order-123',
        status: 'CANCELLED',
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });
      productClient.send.mockReturnValue(of({ success: true }));

      await service.updateStatus(dto);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(productClient.send).toHaveBeenCalledWith(EVENTS.PRODUCT.INC_STOCK, {
        productId: 'prod-1',
        quantity: 2,
      });
      expect(productClient.send).toHaveBeenCalledWith(EVENTS.PRODUCT.INC_STOCK, {
        productId: 'prod-2',
        quantity: 1,
      });
    });

    it('should allow PENDING to CANCELLED transition', async () => {
      const dto: OrderUpdateStatusDto = {
        id: 'order-123',
        status: 'CANCELLED',
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const result = await service.updateStatus(dto);

      expect(result.status).toBe('CANCELLED');
    });

    it('should allow PAID to SHIPPED transition', async () => {
      const dto: OrderUpdateStatusDto = {
        id: 'order-123',
        status: 'SHIPPED',
      };

      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'SHIPPED',
      });

      const result = await service.updateStatus(dto);

      expect(result.status).toBe('SHIPPED');
    });
  });

  describe('cancel', () => {
    it('should cancel PENDING order', async () => {
      const dto: OrderCancelDto = {
        id: 'order-123',
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });
      productClient.send.mockReturnValue(of({ success: true }));

      const result = await service.cancel(dto);

      expect(result.status).toBe('CANCELLED');
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          status: 'CANCELLED',
          updatedAt: expect.any(Date),
        },
        include: { items: true },
      });
    });

    it('should throw EntityNotFoundRpcException when order not found', async () => {
      const dto: OrderCancelDto = {
        id: 'non-existent',
      };

      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.cancel(dto)).rejects.toThrow(EntityNotFoundRpcException);
    });

    it('should throw ConflictRpcException when order already cancelled', async () => {
      const dto: OrderCancelDto = {
        id: 'order-123',
      };

      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      await expect(service.cancel(dto)).rejects.toThrow(ConflictRpcException);
      await expect(service.cancel(dto)).rejects.toThrow('Order is already cancelled');
    });

    it('should throw ValidationRpcException when trying to cancel shipped order', async () => {
      const dto: OrderCancelDto = {
        id: 'order-123',
      };

      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'SHIPPED',
      });

      await expect(service.cancel(dto)).rejects.toThrow(ValidationRpcException);
      await expect(service.cancel(dto)).rejects.toThrow('Cannot cancel shipped orders');
    });

    it('should restore product stock after cancellation', async () => {
      const dto: OrderCancelDto = {
        id: 'order-123',
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });
      productClient.send.mockReturnValue(of({ success: true }));

      await service.cancel(dto);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(productClient.send).toHaveBeenCalledWith(EVENTS.PRODUCT.INC_STOCK, {
        productId: 'prod-1',
        quantity: 2,
      });
      expect(productClient.send).toHaveBeenCalledWith(EVENTS.PRODUCT.INC_STOCK, {
        productId: 'prod-2',
        quantity: 1,
      });
    });

    it('should cancel PAID order', async () => {
      const dto: OrderCancelDto = {
        id: 'order-123',
      };

      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const result = await service.cancel(dto);

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('validateProductsAndStock (private method)', () => {
    it('should validate products exist and have sufficient stock', async () => {
      const items = [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 },
      ];

      productClient.send.mockReturnValue(of(mockProducts));

      const dto: OrderCreateDto = {
        userId: 'user-123',
        addressId: 'addr-123',
        items: items.map(item => ({ ...item, priceInt: 1000 })),
      };

      prisma.order.create.mockResolvedValue(mockOrder);

      await expect(service.create(dto)).resolves.toBeDefined();
    });

    it('should throw when product service returns fewer products than requested', async () => {
      const items = [
        { productId: 'prod-1', quantity: 2, priceInt: 1000 },
        { productId: 'prod-2', quantity: 1, priceInt: 1000 },
      ];

      productClient.send.mockReturnValue(of([mockProducts[0]]));

      const dto: OrderCreateDto = {
        userId: 'user-123',
        addressId: 'addr-123',
        items,
      };

      await expect(service.create(dto)).rejects.toThrow(ValidationRpcException);
    });
  });

  describe('mapToOrderResponse (private method)', () => {
    it('should correctly map order to response format', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.get({ id: 'order-123' } as OrderIdDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('addressId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('totalInt');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should map order items correctly', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.get({ id: 'order-123' } as OrderIdDto);

      expect(result.items).toHaveLength(2);
      result.items.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('orderId');
        expect(item).toHaveProperty('productId');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('priceInt');
        expect(item).toHaveProperty('createdAt');
      });
    });
  });

  describe('validateStatusTransition (private method)', () => {
    it('should allow valid PENDING transitions', async () => {
      const validTransitions = [
        { from: 'PENDING', to: 'PAID' },
        { from: 'PENDING', to: 'CANCELLED' },
      ];

      for (const transition of validTransitions) {
        prisma.order.findUnique.mockResolvedValue({
          ...mockOrder,
          status: transition.from,
        });
        prisma.order.update.mockResolvedValue({
          ...mockOrder,
          status: transition.to,
        });

        await expect(
          service.updateStatus({
            id: 'order-123',
            status: transition.to as 'PAID' | 'CANCELLED',
          }),
        ).resolves.toBeDefined();
      }
    });

    it('should allow valid PAID transitions', async () => {
      const validTransitions = [
        { from: 'PAID', to: 'SHIPPED' },
        { from: 'PAID', to: 'CANCELLED' },
      ];

      for (const transition of validTransitions) {
        prisma.order.findUnique.mockResolvedValue({
          ...mockOrder,
          status: transition.from,
        });
        prisma.order.update.mockResolvedValue({
          ...mockOrder,
          status: transition.to,
        });

        await expect(
          service.updateStatus({
            id: 'order-123',
            status: transition.to as 'SHIPPED' | 'CANCELLED',
          }),
        ).resolves.toBeDefined();
      }
    });

    it('should reject invalid transitions from SHIPPED', async () => {
      const invalidTransitions = ['PENDING', 'PAID', 'CANCELLED'];

      for (const toStatus of invalidTransitions) {
        prisma.order.findUnique.mockResolvedValue({
          ...mockOrder,
          status: 'SHIPPED',
        });

        await expect(
          service.updateStatus({
            id: 'order-123',
            status: toStatus as 'PENDING' | 'PAID' | 'CANCELLED',
          }),
        ).rejects.toThrow(ValidationRpcException);
      }
    });

    it('should reject invalid transitions from CANCELLED', async () => {
      const invalidTransitions = ['PENDING', 'PAID', 'SHIPPED'];

      for (const toStatus of invalidTransitions) {
        prisma.order.findUnique.mockResolvedValue({
          ...mockOrder,
          status: 'CANCELLED',
        });

        await expect(
          service.updateStatus({
            id: 'order-123',
            status: toStatus as 'PENDING' | 'PAID' | 'SHIPPED',
          }),
        ).rejects.toThrow(ValidationRpcException);
      }
    });
  });
});
