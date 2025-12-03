import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import {
  OrderCreateDto,
  OrderIdDto,
  OrderUpdateStatusDto,
  OrderCancelDto,
  OrderListDto,
  OrderAdminListDto,
  OrderUpdatePaymentStatusDto,
} from '@shared/dto/order.dto';
import { OrderResponse, PaginatedOrdersResponse } from '@shared/types/order.types';

describe('OrdersController', () => {
  let controller: OrdersController;
  let mockOrdersService: jest.Mocked<OrdersService>;

  const mockOrderResponse: OrderResponse = {
    id: 'order-123',
    userId: 'user-123',
    addressId: 'addr-123',
    status: 'PENDING',
    totalInt: 3000,
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPaginatedResponse: PaginatedOrdersResponse = {
    orders: [mockOrderResponse],
    total: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  };

  beforeEach(async () => {
    const mockOrdersServiceInstance = {
      create: jest.fn(),
      get: jest.fn(),
      listByUser: jest.fn(),
      listAll: jest.fn(),
      updateStatus: jest.fn(),
      updatePaymentStatus: jest.fn(),
      cancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersServiceInstance,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    mockOrdersService = module.get(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: OrderCreateDto = {
      userId: 'user-123',
      addressId: 'addr-123',
      items: [
        { productId: 'prod-1', quantity: 2, priceInt: 1000 },
        { productId: 'prod-2', quantity: 1, priceInt: 1000 },
      ],
    };

    it('should create order and return order response', async () => {
      mockOrdersService.create.mockResolvedValue(mockOrderResponse);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockOrderResponse);
      expect(mockOrdersService.create).toHaveBeenCalledWith(createDto);
      expect(mockOrdersService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error when items array is empty', async () => {
      const emptyDto = { ...createDto, items: [] };
      const error = new RpcException('Order must contain at least one item');
      mockOrdersService.create.mockRejectedValue(error);

      await expect(controller.create(emptyDto)).rejects.toThrow(error);
      expect(mockOrdersService.create).toHaveBeenCalledWith(emptyDto);
    });

    it('should throw error when product not found', async () => {
      const error = new RpcException('Products not found: prod-2');
      mockOrdersService.create.mockRejectedValue(error);

      await expect(controller.create(createDto)).rejects.toThrow(error);
    });

    it('should throw error when insufficient stock', async () => {
      const error = new RpcException('Insufficient stock for product Product 1');
      mockOrdersService.create.mockRejectedValue(error);

      await expect(controller.create(createDto)).rejects.toThrow(error);
    });

    it('should create order without addressId', async () => {
      const dtoWithoutAddress = { ...createDto, addressId: undefined };
      const responseWithoutAddress = { ...mockOrderResponse, addressId: null };
      mockOrdersService.create.mockResolvedValue(responseWithoutAddress);

      const result = await controller.create(dtoWithoutAddress);

      expect(result.addressId).toBeNull();
      expect(mockOrdersService.create).toHaveBeenCalledWith(dtoWithoutAddress);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database connection failed');
      mockOrdersService.create.mockRejectedValue(error);

      await expect(controller.create(createDto)).rejects.toThrow(error);
    });
  });

  describe('get', () => {
    const getDto: OrderIdDto = { id: 'order-123' };

    it('should return order by id', async () => {
      mockOrdersService.get.mockResolvedValue(mockOrderResponse);

      const result = await controller.get(getDto);

      expect(result).toEqual(mockOrderResponse);
      expect(mockOrdersService.get).toHaveBeenCalledWith(getDto);
      expect(mockOrdersService.get).toHaveBeenCalledTimes(1);
    });

    it('should throw error when order not found', async () => {
      const error = new RpcException('Order với ID order-123 không tồn tại');
      mockOrdersService.get.mockRejectedValue(error);

      await expect(controller.get(getDto)).rejects.toThrow(error);
      expect(mockOrdersService.get).toHaveBeenCalledWith(getDto);
    });

    it('should return order with all items', async () => {
      mockOrdersService.get.mockResolvedValue(mockOrderResponse);

      const result = await controller.get(getDto);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty('productId');
      expect(result.items[0]).toHaveProperty('quantity');
      expect(result.items[0]).toHaveProperty('priceInt');
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockOrdersService.get.mockRejectedValue(error);

      await expect(controller.get(getDto)).rejects.toThrow(error);
    });
  });

  describe('listByUser', () => {
    const listDto: OrderListDto = {
      userId: 'user-123',
      page: 1,
      pageSize: 10,
    };

    it('should return paginated orders for user', async () => {
      mockOrdersService.listByUser.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.list(listDto);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockOrdersService.listByUser).toHaveBeenCalledWith(listDto);
      expect(mockOrdersService.listByUser).toHaveBeenCalledTimes(1);
    });

    it('should return empty list when user has no orders', async () => {
      const emptyResponse: PaginatedOrdersResponse = {
        orders: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockOrdersService.listByUser.mockResolvedValue(emptyResponse);

      const result = await controller.list(listDto);

      expect(result.orders).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should use default pagination values', async () => {
      const dtoWithoutPagination = { userId: 'user-123' };
      mockOrdersService.listByUser.mockResolvedValue(mockPaginatedResponse);

      await controller.list(dtoWithoutPagination as OrderListDto);

      expect(mockOrdersService.listByUser).toHaveBeenCalledWith(dtoWithoutPagination);
    });

    it('should handle large page numbers', async () => {
      const largePage = { ...listDto, page: 100 };
      const emptyResponse: PaginatedOrdersResponse = {
        orders: [],
        total: 50,
        page: 100,
        pageSize: 10,
        totalPages: 5,
      };
      mockOrdersService.listByUser.mockResolvedValue(emptyResponse);

      const result = await controller.list(largePage);

      expect(result.orders).toEqual([]);
      expect(result.page).toBe(100);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockOrdersService.listByUser.mockRejectedValue(error);

      await expect(controller.list(listDto)).rejects.toThrow(error);
    });
  });

  describe('updateStatus', () => {
    const updateDto: OrderUpdateStatusDto = {
      id: 'order-123',
      status: 'PROCESSING',
    };

    it('should update order status successfully', async () => {
      const updatedOrder: OrderResponse = { ...mockOrderResponse, status: 'PROCESSING' };
      mockOrdersService.updateStatus.mockResolvedValue(updatedOrder);

      const result = await controller.updateStatus(updateDto);

      expect(result.status).toBe('PROCESSING');
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(updateDto);
      expect(mockOrdersService.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('should throw error when order not found', async () => {
      const error = new RpcException('Order với ID order-123 không tồn tại');
      mockOrdersService.updateStatus.mockRejectedValue(error);

      await expect(controller.updateStatus(updateDto)).rejects.toThrow(error);
    });

    it('should throw error for invalid status transition', async () => {
      const error = new RpcException('Invalid status transition from SHIPPED to PENDING');
      mockOrdersService.updateStatus.mockRejectedValue(error);

      await expect(controller.updateStatus(updateDto)).rejects.toThrow(error);
    });

    it('should update status to SHIPPED', async () => {
      const shippedDto: OrderUpdateStatusDto = { id: 'order-123', status: 'SHIPPED' };
      const shippedOrder: OrderResponse = { ...mockOrderResponse, status: 'SHIPPED' };
      mockOrdersService.updateStatus.mockResolvedValue(shippedOrder);

      const result = await controller.updateStatus(shippedDto);

      expect(result.status).toBe('SHIPPED');
    });

    it('should update status to CANCELLED', async () => {
      const cancelledDto: OrderUpdateStatusDto = { id: 'order-123', status: 'CANCELLED' };
      const cancelledOrder: OrderResponse = { ...mockOrderResponse, status: 'CANCELLED' };
      mockOrdersService.updateStatus.mockResolvedValue(cancelledOrder);

      const result = await controller.updateStatus(cancelledDto);

      expect(result.status).toBe('CANCELLED');
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockOrdersService.updateStatus.mockRejectedValue(error);

      await expect(controller.updateStatus(updateDto)).rejects.toThrow(error);
    });
  });

  describe('cancel', () => {
    const cancelDto: OrderCancelDto = {
      id: 'order-123',
    };

    it('should cancel order successfully', async () => {
      const cancelledOrder: OrderResponse = { ...mockOrderResponse, status: 'CANCELLED' };
      mockOrdersService.cancel.mockResolvedValue(cancelledOrder);

      const result = await controller.cancel(cancelDto);

      expect(result.status).toBe('CANCELLED');
      expect(mockOrdersService.cancel).toHaveBeenCalledWith(cancelDto);
      expect(mockOrdersService.cancel).toHaveBeenCalledTimes(1);
    });

    it('should throw error when order not found', async () => {
      const error = new RpcException('Order với ID order-123 không tồn tại');
      mockOrdersService.cancel.mockRejectedValue(error);

      await expect(controller.cancel(cancelDto)).rejects.toThrow(error);
    });

    it('should throw error when order already cancelled', async () => {
      const error = new RpcException('Order is already cancelled');
      mockOrdersService.cancel.mockRejectedValue(error);

      await expect(controller.cancel(cancelDto)).rejects.toThrow(error);
    });

    it('should throw error when trying to cancel shipped order', async () => {
      const error = new RpcException('Cannot cancel shipped orders');
      mockOrdersService.cancel.mockRejectedValue(error);

      await expect(controller.cancel(cancelDto)).rejects.toThrow(error);
    });

    it('should cancel order with reason', async () => {
      const cancelWithReason = { ...cancelDto, reason: 'Customer changed mind' };
      const cancelledOrder: OrderResponse = { ...mockOrderResponse, status: 'CANCELLED' };
      mockOrdersService.cancel.mockResolvedValue(cancelledOrder);

      const result = await controller.cancel(cancelWithReason);

      expect(result.status).toBe('CANCELLED');
      expect(mockOrdersService.cancel).toHaveBeenCalledWith(cancelWithReason);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockOrdersService.cancel.mockRejectedValue(error);

      await expect(controller.cancel(cancelDto)).rejects.toThrow(error);
    });
  });

  describe('Controller Dependency Injection', () => {
    it('should have OrdersService injected', () => {
      expect(controller).toBeDefined();
      const controllerWithService = controller as unknown as { ordersService: OrdersService };
      expect(controllerWithService.ordersService).toBeDefined();
    });

    it('should create controller instance', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [OrdersController],
        providers: [
          {
            provide: OrdersService,
            useValue: {
              create: jest.fn(),
              get: jest.fn(),
              listByUser: jest.fn(),
              updateStatus: jest.fn(),
              cancel: jest.fn(),
            },
          },
        ],
      }).compile();

      const controllerInstance = module.get<OrdersController>(OrdersController);
      expect(controllerInstance).toBeInstanceOf(OrdersController);
    });
  });

  describe('listAll', () => {
    const listAllDto: OrderAdminListDto = {
      page: 1,
      pageSize: 10,
      status: 'PENDING',
    };

    it('should return paginated orders for admin', async () => {
      mockOrdersService.listAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.listAll(listAllDto);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockOrdersService.listAll).toHaveBeenCalledWith(listAllDto);
      expect(mockOrdersService.listAll).toHaveBeenCalledTimes(1);
    });

    it('should handle filters correctly', async () => {
      const filteredDto: OrderAdminListDto = {
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        search: 'user-123',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      mockOrdersService.listAll.mockResolvedValue(mockPaginatedResponse);

      await controller.listAll(filteredDto);

      expect(mockOrdersService.listAll).toHaveBeenCalledWith(filteredDto);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockOrdersService.listAll.mockRejectedValue(error);

      await expect(controller.listAll(listAllDto)).rejects.toThrow(error);
    });
  });

  describe('updatePaymentStatus', () => {
    const updatePaymentDto: OrderUpdatePaymentStatusDto = {
      id: 'order-123',
      paymentStatus: 'PAID',
    };

    it('should update paymentStatus successfully', async () => {
      const updatedOrder: OrderResponse = { ...mockOrderResponse, paymentStatus: 'PAID' };
      mockOrdersService.updatePaymentStatus.mockResolvedValue(updatedOrder);

      const result = await controller.updatePaymentStatus(updatePaymentDto);

      expect(result.paymentStatus).toBe('PAID');
      expect(mockOrdersService.updatePaymentStatus).toHaveBeenCalledWith(updatePaymentDto);
      expect(mockOrdersService.updatePaymentStatus).toHaveBeenCalledTimes(1);
    });

    it('should throw error when order not found', async () => {
      const error = new RpcException('Order với ID order-123 không tồn tại');
      mockOrdersService.updatePaymentStatus.mockRejectedValue(error);

      await expect(controller.updatePaymentStatus(updatePaymentDto)).rejects.toThrow(error);
    });

    it('should update paymentStatus to different values', async () => {
      const statuses = ['PAID', 'UNPAID', 'REFUNDED'] as const;

      for (const paymentStatus of statuses) {
        const dto: OrderUpdatePaymentStatusDto = {
          id: 'order-123',
          paymentStatus,
        };
        const updatedOrder: OrderResponse = { ...mockOrderResponse, paymentStatus };
        mockOrdersService.updatePaymentStatus.mockResolvedValue(updatedOrder);

        const result = await controller.updatePaymentStatus(dto);
        expect(result.paymentStatus).toBe(paymentStatus);
      }
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockOrdersService.updatePaymentStatus.mockRejectedValue(error);

      await expect(controller.updatePaymentStatus(updatePaymentDto)).rejects.toThrow(error);
    });
  });
});
