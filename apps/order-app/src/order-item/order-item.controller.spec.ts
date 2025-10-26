import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { OrderItemController } from './order-item.controller';
import { OrderItemService } from './order-item.service';
import { OrderItemResponse } from '@shared/types/order.types';
import {
  OrderItemListByOrderDto,
  OrderItemAddDto,
  OrderItemRemoveDto,
} from '@shared/dto/order.dto';

describe('OrderItemController', () => {
  let controller: OrderItemController;
  let mockOrderItemService: jest.Mocked<OrderItemService>;

  const mockOrderItemResponse: OrderItemResponse = {
    id: 'item-123',
    orderId: 'order-123',
    productId: 'prod-1',
    quantity: 2,
    priceInt: 1500,
    createdAt: new Date(),
  };

  const mockOrderItemList: OrderItemResponse[] = [
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
      priceInt: 2000,
      createdAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(async () => {
    const mockOrderItemServiceInstance = {
      listByOrder: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderItemController],
      providers: [
        {
          provide: OrderItemService,
          useValue: mockOrderItemServiceInstance,
        },
      ],
    }).compile();

    controller = module.get<OrderItemController>(OrderItemController);
    mockOrderItemService = module.get(OrderItemService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listByOrder', () => {
    it('should call OrderItemService.listByOrder and return order items', async () => {
      const dto: OrderItemListByOrderDto = { orderId: 'order-123' };
      mockOrderItemService.listByOrder.mockResolvedValue(mockOrderItemList);

      const result = await controller.listByOrder(dto);

      expect(result).toEqual(mockOrderItemList);
      expect(mockOrderItemService.listByOrder).toHaveBeenCalledWith(dto);
      expect(mockOrderItemService.listByOrder).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when order has no items', async () => {
      const dto: OrderItemListByOrderDto = { orderId: 'order-empty' };
      mockOrderItemService.listByOrder.mockResolvedValue([]);

      const result = await controller.listByOrder(dto);

      expect(result).toEqual([]);
      expect(mockOrderItemService.listByOrder).toHaveBeenCalledWith(dto);
    });

    it('should throw EntityNotFoundRpcException when order does not exist', async () => {
      const dto: OrderItemListByOrderDto = { orderId: 'non-existent' };
      const rpcError = new RpcException('Order not found');
      mockOrderItemService.listByOrder.mockRejectedValue(rpcError);

      await expect(controller.listByOrder(dto)).rejects.toThrow(rpcError);
      expect(mockOrderItemService.listByOrder).toHaveBeenCalledWith(dto);
    });

    it('should propagate unexpected errors from service', async () => {
      const dto: OrderItemListByOrderDto = { orderId: 'order-123' };
      const unexpectedError = new Error('Database connection failed');
      mockOrderItemService.listByOrder.mockRejectedValue(unexpectedError);

      await expect(controller.listByOrder(dto)).rejects.toThrow(unexpectedError);
      expect(mockOrderItemService.listByOrder).toHaveBeenCalledWith(dto);
    });

    it('should handle service timeout errors', async () => {
      const dto: OrderItemListByOrderDto = { orderId: 'order-123' };
      const timeoutError = new RpcException('Service timeout');
      mockOrderItemService.listByOrder.mockRejectedValue(timeoutError);

      await expect(controller.listByOrder(dto)).rejects.toThrow(timeoutError);
    });

    it('should handle multiple items correctly', async () => {
      const dto: OrderItemListByOrderDto = { orderId: 'order-large' };
      const largeList = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        orderId: dto.orderId,
        productId: `prod-${i}`,
        quantity: i + 1,
        priceInt: (i + 1) * 100,
        createdAt: new Date(),
      }));
      mockOrderItemService.listByOrder.mockResolvedValue(largeList);

      const result = await controller.listByOrder(dto);

      expect(result).toHaveLength(50);
      expect(result).toEqual(largeList);
    });
  });

  describe('addItem', () => {
    it('should call OrderItemService.addItem and return created order item', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1500,
      };
      mockOrderItemService.addItem.mockResolvedValue(mockOrderItemResponse);

      const result = await controller.addItem(dto);

      expect(result).toEqual(mockOrderItemResponse);
      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(dto);
      expect(mockOrderItemService.addItem).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationRpcException when quantity is invalid', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 0,
        priceInt: 1500,
      };
      const validationError = new RpcException('Số lượng phải lớn hơn 0');
      mockOrderItemService.addItem.mockRejectedValue(validationError);

      await expect(controller.addItem(dto)).rejects.toThrow(validationError);
      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(dto);
    });

    it('should throw ValidationRpcException when price is invalid', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: -100,
      };
      const validationError = new RpcException('Đơn giá phải lớn hơn 0');
      mockOrderItemService.addItem.mockRejectedValue(validationError);

      await expect(controller.addItem(dto)).rejects.toThrow(validationError);
      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(dto);
    });

    it('should throw EntityNotFoundRpcException when order does not exist', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'non-existent',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1500,
      };
      const notFoundError = new RpcException('Order not found');
      mockOrderItemService.addItem.mockRejectedValue(notFoundError);

      await expect(controller.addItem(dto)).rejects.toThrow(notFoundError);
      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(dto);
    });

    it('should throw InternalServerRpcException on database error', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1500,
      };
      const dbError = new RpcException('Không thể thêm sản phẩm vào đơn hàng');
      mockOrderItemService.addItem.mockRejectedValue(dbError);

      await expect(controller.addItem(dto)).rejects.toThrow(dbError);
      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(dto);
    });

    it('should handle large quantities correctly', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 9999,
        priceInt: 100,
      };
      const largeQtyResponse: OrderItemResponse = {
        ...mockOrderItemResponse,
        quantity: 9999,
      };
      mockOrderItemService.addItem.mockResolvedValue(largeQtyResponse);

      const result = await controller.addItem(dto);

      expect(result.quantity).toBe(9999);
      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(dto);
    });

    it('should handle large prices correctly', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-123',
        productId: 'prod-premium',
        quantity: 1,
        priceInt: 999999999,
      };
      const expensiveItemResponse: OrderItemResponse = {
        ...mockOrderItemResponse,
        priceInt: 999999999,
        productId: 'prod-premium',
      };
      mockOrderItemService.addItem.mockResolvedValue(expensiveItemResponse);

      const result = await controller.addItem(dto);

      expect(result.priceInt).toBe(999999999);
      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(dto);
    });

    it('should propagate unexpected errors from service', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-123',
        productId: 'prod-1',
        quantity: 2,
        priceInt: 1500,
      };
      const unexpectedError = new Error('Unexpected service error');
      mockOrderItemService.addItem.mockRejectedValue(unexpectedError);

      await expect(controller.addItem(dto)).rejects.toThrow(unexpectedError);
    });

    it('should pass DTO correctly to service', async () => {
      const dto: OrderItemAddDto = {
        orderId: 'order-456',
        productId: 'prod-789',
        quantity: 5,
        priceInt: 2500,
      };
      mockOrderItemService.addItem.mockResolvedValue(mockOrderItemResponse);

      await controller.addItem(dto);

      expect(mockOrderItemService.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-456',
          productId: 'prod-789',
          quantity: 5,
          priceInt: 2500,
        }),
      );
    });
  });

  describe('removeItem', () => {
    it('should call OrderItemService.removeItem and return success', async () => {
      const dto: OrderItemRemoveDto = { id: 'item-123' };
      mockOrderItemService.removeItem.mockResolvedValue(undefined);

      const result = await controller.removeItem(dto);

      expect(result).toBeUndefined();
      expect(mockOrderItemService.removeItem).toHaveBeenCalledWith(dto);
      expect(mockOrderItemService.removeItem).toHaveBeenCalledTimes(1);
    });

    it('should throw EntityNotFoundRpcException when order item does not exist', async () => {
      const dto: OrderItemRemoveDto = { id: 'non-existent' };
      const notFoundError = new RpcException('OrderItem not found');
      mockOrderItemService.removeItem.mockRejectedValue(notFoundError);

      await expect(controller.removeItem(dto)).rejects.toThrow(notFoundError);
      expect(mockOrderItemService.removeItem).toHaveBeenCalledWith(dto);
    });

    it('should throw InternalServerRpcException on database error', async () => {
      const dto: OrderItemRemoveDto = { id: 'item-123' };
      const dbError = new RpcException('Không thể xóa sản phẩm khỏi đơn hàng');
      mockOrderItemService.removeItem.mockRejectedValue(dbError);

      await expect(controller.removeItem(dto)).rejects.toThrow(dbError);
      expect(mockOrderItemService.removeItem).toHaveBeenCalledWith(dto);
    });

    it('should propagate unexpected errors from service', async () => {
      const dto: OrderItemRemoveDto = { id: 'item-123' };
      const unexpectedError = new Error('Service unavailable');
      mockOrderItemService.removeItem.mockRejectedValue(unexpectedError);

      await expect(controller.removeItem(dto)).rejects.toThrow(unexpectedError);
      expect(mockOrderItemService.removeItem).toHaveBeenCalledWith(dto);
    });

    it('should handle concurrent remove requests', async () => {
      const dtos: OrderItemRemoveDto[] = [{ id: 'item-1' }, { id: 'item-2' }, { id: 'item-3' }];
      mockOrderItemService.removeItem.mockResolvedValue(undefined);

      const results = await Promise.all(dtos.map(dto => controller.removeItem(dto)));

      expect(results).toEqual([undefined, undefined, undefined]);
      expect(mockOrderItemService.removeItem).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple remove requests with mixed results', async () => {
      mockOrderItemService.removeItem
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new RpcException('Item not found'))
        .mockResolvedValueOnce(undefined);

      const dto1 = { id: 'item-1' };
      const dto2 = { id: 'item-2' };
      const dto3 = { id: 'item-3' };

      const result1 = await controller.removeItem(dto1);
      expect(result1).toBeUndefined();

      await expect(controller.removeItem(dto2)).rejects.toThrow(RpcException);

      const result3 = await controller.removeItem(dto3);
      expect(result3).toBeUndefined();

      expect(mockOrderItemService.removeItem).toHaveBeenCalledTimes(3);
    });

    it('should pass correct DTO to service', async () => {
      const dto: OrderItemRemoveDto = { id: 'item-xyz-789' };
      mockOrderItemService.removeItem.mockResolvedValue(undefined);

      await controller.removeItem(dto);

      expect(mockOrderItemService.removeItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-xyz-789',
        }),
      );
    });
  });

  describe('Controller Dependency Injection', () => {
    it('should have OrderItemService injected', () => {
      expect(controller).toBeDefined();
      const controllerWithService = controller as unknown as {
        orderItemService: OrderItemService;
      };
      expect(controllerWithService.orderItemService).toBeDefined();
    });

    it('should create controller instance', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [OrderItemController],
        providers: [
          {
            provide: OrderItemService,
            useValue: {
              listByOrder: jest.fn(),
              addItem: jest.fn(),
              removeItem: jest.fn(),
            },
          },
        ],
      }).compile();

      const controllerInstance = module.get<OrderItemController>(OrderItemController);
      expect(controllerInstance).toBeInstanceOf(OrderItemController);
    });
  });
});
