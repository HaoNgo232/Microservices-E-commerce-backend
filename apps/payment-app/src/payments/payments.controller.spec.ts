import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@payment-app/prisma/prisma.service';
import { PaymentMethod, PaymentProcessResponse, PaymentStatus } from '@shared/types/payment.types';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockPaymentsService: jest.Mocked<PaymentsService>;

  const mockPaymentResponse = {
    id: 'payment-123',
    orderId: 'order-123',
    method: PaymentMethod.COD,
    amountInt: 100000,
    status: PaymentStatus.PAID,
    payload: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPaymentsServiceInstance = {
      process: jest.fn(),
      verify: jest.fn(),
      getById: jest.fn(),
      getByOrder: jest.fn(),
      handleSePayWebhook: jest.fn(),
      confirmCodPayment: jest.fn(),
    };

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
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsServiceInstance,
        },
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

    controller = module.get<PaymentsController>(PaymentsController);
    mockPaymentsService = module.get(PaymentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sepayWebhook', () => {
    it('should handle SePay webhook successfully', async () => {
      // Arrange
      const webhookDto = {
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

      const mockResponse = {
        success: true,
        message: 'Payment processed successfully',
        orderId: '123',
        paymentId: 'payment-123',
      };

      mockPaymentsService.handleSePayWebhook.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.sepayWebhook(webhookDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockPaymentsService.handleSePayWebhook).toHaveBeenCalledWith(webhookDto);
      expect(mockPaymentsService.handleSePayWebhook).toHaveBeenCalledTimes(1);
    });

    it('should handle duplicate webhook gracefully', async () => {
      // Arrange
      const webhookDto = {
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

      const mockResponse = {
        success: true,
        message: 'Transaction already processed (duplicate webhook)',
      };

      mockPaymentsService.handleSePayWebhook.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.sepayWebhook(webhookDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.message).toContain('duplicate');
    });

    it('should handle webhook with outgoing transfer', async () => {
      // Arrange
      const webhookDto = {
        id: 12346,
        gateway: 'MBBank',
        transactionDate: '2024-01-01 10:00:00',
        accountNumber: '0123456789',
        subAccount: null,
        transferType: 'out' as const,
        transferAmount: 50000,
        accumulated: 950000,
        code: 'CODE124',
        content: 'Chi tieu',
        referenceCode: 'REF124',
        description: 'Outgoing transaction',
      };

      const mockResponse = {
        success: true,
        message: 'Transaction saved (not an incoming payment)',
      };

      mockPaymentsService.handleSePayWebhook.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.sepayWebhook(webhookDto);

      // Assert
      expect(result).toEqual(mockResponse);
    });
  });

  describe('process', () => {
    it('should process COD payment successfully', async () => {
      // Arrange
      const processDto = {
        orderId: 'order-123',
        method: PaymentMethod.COD,
        amountInt: 100000,
      };

      const mockResponse = {
        paymentId: 'payment-123',
        status: PaymentStatus.PAID,
        message: 'COD payment processed successfully',
      };

      mockPaymentsService.process.mockResolvedValue(mockResponse);

      // Act
      const result: PaymentProcessResponse = await controller.process(processDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockPaymentsService.process).toHaveBeenCalledWith(processDto);
      expect(mockPaymentsService.process).toHaveBeenCalledTimes(1);
    });

    it('should process SePay payment and return payment URL', async () => {
      // Arrange
      const processDto = {
        orderId: 'order-123',
        method: PaymentMethod.SEPAY,
        amountInt: 100000,
      };

      const mockResponse = {
        paymentId: 'payment-123',
        status: 'UNPAID' as const,
        paymentUrl: 'https://sepay.vn/payment/payment-123',
        message: 'Redirect to payment gateway',
      };

      mockPaymentsService.process.mockResolvedValue(mockResponse);

      // Act
      const result: PaymentProcessResponse = await controller.process(processDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.paymentUrl).toBeDefined();
      expect(mockPaymentsService.process).toHaveBeenCalledWith(processDto);
    });
  });

  describe('verify', () => {
    it('should verify payment successfully', async () => {
      // Arrange
      const verifyDto = {
        orderId: 'order-123',
        payload: {
          status: 'success',
          transactionId: 'txn-123',
        },
      };

      const mockResponse = {
        paymentId: 'payment-123',
        orderId: 'order-123',
        status: PaymentStatus.PAID,
        verified: true,
        transactionId: 'txn-123',
        message: 'Payment verified successfully',
      };

      mockPaymentsService.verify.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.verify(verifyDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.verified).toBe(true);
      expect(mockPaymentsService.verify).toHaveBeenCalledWith(verifyDto);
      expect(mockPaymentsService.verify).toHaveBeenCalledTimes(1);
    });

    it('should fail verification with invalid payload', async () => {
      // Arrange
      const verifyDto = {
        orderId: 'order-123',
        payload: {
          status: 'failed',
        },
      };

      const mockResponse = {
        paymentId: 'payment-123',
        orderId: 'order-123',
        status: PaymentStatus.UNPAID,
        verified: false,
        message: 'Payment verification failed',
      };

      mockPaymentsService.verify.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.verify(verifyDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.verified).toBe(false);
    });
  });

  describe('getById', () => {
    it('should get payment by ID', async () => {
      // Arrange
      const getByIdDto = { id: 'payment-123' };

      mockPaymentsService.getById.mockResolvedValue(mockPaymentResponse);

      // Act
      const result = await controller.getById(getByIdDto);

      // Assert
      expect(result).toEqual(mockPaymentResponse);
      expect(mockPaymentsService.getById).toHaveBeenCalledWith(getByIdDto);
      expect(mockPaymentsService.getById).toHaveBeenCalledTimes(1);
    });
  });

  describe('getByOrder', () => {
    it('should get payment by order ID', async () => {
      // Arrange
      const getByOrderDto = { orderId: 'order-123' };

      mockPaymentsService.getByOrder.mockResolvedValue(mockPaymentResponse);

      // Act
      const result = await controller.getByOrder(getByOrderDto);

      // Assert
      expect(result).toEqual(mockPaymentResponse);
      expect(result.orderId).toBe('order-123');
      expect(mockPaymentsService.getByOrder).toHaveBeenCalledWith(getByOrderDto);
      expect(mockPaymentsService.getByOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmCod', () => {
    it('should confirm COD payment by payment ID', async () => {
      // Arrange
      const confirmDto = { id: 'payment-123' };
      const confirmedPayment = {
        ...mockPaymentResponse,
        status: PaymentStatus.PAID,
      };
      mockPaymentsService.confirmCodPayment.mockResolvedValue(confirmedPayment);

      // Act
      const result = await controller.confirmCod(confirmDto);

      // Assert
      expect(result).toEqual(confirmedPayment);
      expect(result.status).toBe(PaymentStatus.PAID);
      expect(mockPaymentsService.confirmCodPayment).toHaveBeenCalledWith(confirmDto);
      expect(mockPaymentsService.confirmCodPayment).toHaveBeenCalledTimes(1);
    });

    it('should confirm COD payment by order ID', async () => {
      // Arrange
      const confirmDto = { orderId: 'order-123' };
      const confirmedPayment = {
        ...mockPaymentResponse,
        status: PaymentStatus.PAID,
      };
      mockPaymentsService.confirmCodPayment.mockResolvedValue(confirmedPayment);

      // Act
      const result = await controller.confirmCod(confirmDto);

      // Assert
      expect(result).toEqual(confirmedPayment);
      expect(mockPaymentsService.confirmCodPayment).toHaveBeenCalledWith(confirmDto);
    });

    it('should propagate service errors', async () => {
      // Arrange
      const confirmDto = { id: 'payment-123' };
      const error = new Error('Payment not found');
      mockPaymentsService.confirmCodPayment.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.confirmCod(confirmDto)).rejects.toThrow(error);
    });
  });
});
