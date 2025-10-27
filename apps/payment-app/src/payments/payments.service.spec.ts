import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@payment-app/prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
} from '@shared/exceptions/rpc-exceptions';

describe('PaymentsService', () => {
  let service: PaymentsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  let mockOrderClient: jest.Mocked<ClientProxy>;

  const mockOrder = {
    id: 'order-123',
    userId: 'user-123',
    status: 'PENDING',
    totalInt: 100000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayment = {
    id: 'payment-123',
    orderId: 'order-123',
    method: 'SEPAY',
    amountInt: 100000,
    status: 'PENDING',
    payload: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockClientProxy = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'ORDER_SERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    mockPrisma = module.get(PrismaService);
    mockOrderClient = module.get('ORDER_SERVICE');

    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should process COD payment successfully', async () => {
      // Arrange
      mockOrderClient.send.mockReturnValue(of(mockOrder));
      mockPrisma.payment.create.mockResolvedValue({
        ...mockPayment,
        method: 'COD',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'SUCCESS',
      });

      // Act
      const result = await service.process({
        orderId: 'order-123',
        method: 'COD',
        amountInt: 100000,
      });

      // Assert
      expect(result.status).toBe('SUCCESS');
      expect(result.message).toBe('COD payment processed successfully');
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-123',
          method: 'COD',
          amountInt: 100000,
          status: 'PENDING',
          payload: false,
        },
      });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: { status: 'SUCCESS' },
      });
    });

    it('should process SePay payment and return payment URL', async () => {
      // Arrange
      mockOrderClient.send.mockReturnValue(of(mockOrder));
      mockPrisma.payment.create.mockResolvedValue(mockPayment);

      // Act
      const result = await service.process({
        orderId: 'order-123',
        method: 'SePay',
        amountInt: 100000,
      });

      // Assert
      expect(result.status).toBe('PENDING');
      expect(result.paymentUrl).toBe(`https://sepay.vn/payment/${mockPayment.id}`);
      expect(result.message).toBe('Redirect to payment gateway');
    });

    it('should throw ValidationRpcException when order status is not PENDING', async () => {
      // Arrange
      mockOrderClient.send.mockReturnValue(
        of({
          ...mockOrder,
          status: 'PAID',
        }),
      );

      // Act & Assert
      await expect(
        service.process({
          orderId: 'order-123',
          method: 'COD',
          amountInt: 100000,
        }),
      ).rejects.toThrow(ValidationRpcException);
    });

    it('should throw EntityNotFoundRpcException when order not found', async () => {
      // Arrange
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      mockOrderClient.send.mockReturnValue(throwError(() => timeoutError));

      // Act & Assert
      await expect(
        service.process({
          orderId: 'order-999',
          method: 'COD',
          amountInt: 100000,
        }),
      ).rejects.toThrow(ValidationRpcException);
    });

    it('should handle generic errors during process', async () => {
      // Arrange
      mockOrderClient.send.mockReturnValue(of(mockOrder));
      mockPrisma.payment.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.process({
          orderId: 'order-123',
          method: 'COD',
          amountInt: 100000,
        }),
      ).rejects.toThrow(ValidationRpcException);
    });
  });

  describe('verify', () => {
    it('should verify payment successfully', async () => {
      // Arrange
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'SUCCESS',
      });
      mockOrderClient.send.mockReturnValue(of({ success: true }));

      // Act
      const result = await service.verify({
        orderId: 'order-123',
        payload: {
          status: 'success',
          transactionId: 'txn-123',
        },
      });

      // Assert
      expect(result.status).toBe('SUCCESS');
      expect(result.verified).toBe(true);
      expect(result.transactionId).toBe('txn-123');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: { status: 'SUCCESS' },
      });
    });

    it('should fail verification when payload is invalid', async () => {
      // Arrange
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'FAILED',
      });

      // Act
      const result = await service.verify({
        orderId: 'order-123',
        payload: {
          status: 'failed',
        },
      });

      // Assert
      expect(result.status).toBe('FAILED');
      expect(result.verified).toBe(false);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: {
          status: 'FAILED',
          payload: { status: 'failed' },
        },
      });
    });

    it('should throw EntityNotFoundRpcException when payment not found', async () => {
      // Arrange
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.verify({
          orderId: 'order-999',
          payload: {},
        }),
      ).rejects.toThrow(EntityNotFoundRpcException);
    });

    it('should handle errors during verify', async () => {
      // Arrange
      mockPrisma.payment.findFirst.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.verify({
          orderId: 'order-123',
          payload: {},
        }),
      ).rejects.toThrow(ValidationRpcException);
    });
  });

  describe('getById', () => {
    it('should get payment by ID', async () => {
      // Arrange
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      // Act
      const result = await service.getById({ id: 'payment-123' });

      // Assert
      expect(result.id).toBe('payment-123');
      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
      });
    });

    it('should throw EntityNotFoundRpcException when payment not found', async () => {
      // Arrange
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getById({ id: 'payment-999' })).rejects.toThrow(
        EntityNotFoundRpcException,
      );
    });
  });

  describe('getByOrder', () => {
    it('should get payment by order ID', async () => {
      // Arrange
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      // Act
      const result = await service.getByOrder({ orderId: 'order-123' });

      // Assert
      expect(result.orderId).toBe('order-123');
      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({
        where: { orderId: 'order-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw EntityNotFoundRpcException when payment not found', async () => {
      // Arrange
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getByOrder({ orderId: 'order-999' })).rejects.toThrow(
        EntityNotFoundRpcException,
      );
    });
  });

  describe('handleSePayWebhook', () => {
    const mockWebhookDto = {
      id: 12345,
      gateway: 'MBBank',
      transactionDate: '2024-01-01 10:00:00',
      accountNumber: '0123456789',
      subAccount: null,
      transferType: 'in' as const,
      transferAmount: 100000,
      accumulated: 1000000,
      code: 'CODE123',
      content: 'Thanh toan DH123',
      referenceCode: 'REF123',
      description: 'Test transaction',
    };

    it('should process webhook successfully and update payment', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'SUCCESS',
      });
      mockOrderClient.send.mockReturnValue(of({ success: true }));

      // Act
      const result = await service.handleSePayWebhook(mockWebhookDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment processed successfully');
      expect(result.orderId).toBe('123');
      expect(mockPrisma.transaction.create).toHaveBeenCalled();
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: expect.objectContaining({
          status: 'SUCCESS',
        }),
      });
    });

    it('should ignore duplicate webhook', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue({});

      // Act
      const result = await service.handleSePayWebhook(mockWebhookDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction already processed (duplicate webhook)');
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('should save transaction but not process outgoing transfers', async () => {
      // Arrange
      const outgoingDto = { ...mockWebhookDto, transferType: 'out' as const };
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});

      // Act
      const result = await service.handleSePayWebhook(outgoingDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction saved (not an incoming payment)');
      expect(mockPrisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('should save transaction when no order ID in content', async () => {
      // Arrange
      const noOrderDto = { ...mockWebhookDto, content: 'No order ID here' };
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});

      // Act
      const result = await service.handleSePayWebhook(noOrderDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction saved (no order ID in content)');
    });

    it('should save transaction when no matching payment found', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.handleSePayWebhook(mockWebhookDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction saved (no matching pending payment)');
    });

    it('should return false on internal error', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.handleSePayWebhook(mockWebhookDto);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Internal error processing webhook');
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
