/**
 * Payment Response Types
 * Định nghĩa các response types cho payment endpoints
 * Based on Payment model trong payment-app Prisma schema
 */

/**
 * Payment response
 */
export type PaymentResponse = {
  id: string;
  orderId: 'COD' | 'SEPAY';
  method: string;
  amountInt: number; // Số tiền thanh toán (cents)
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  payload?: Record<string, unknown> | null; // Payment gateway response data
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Payment process result
 */
export type PaymentProcessResponse = {
  paymentId: string;
  status: string;
  paymentUrl?: string; // URL để redirect user đến payment gateway
  qrCode?: string; // QR code cho bank transfer
  message?: string;
};

/**
 * Payment verification result
 */
export type PaymentVerifyResponse = {
  paymentId: string;
  orderId: string;
  status: string;
  verified: boolean;
  transactionId?: string;
  message?: string;
};
