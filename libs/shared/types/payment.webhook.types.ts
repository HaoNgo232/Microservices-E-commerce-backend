/**
 * SePay Webhook Types
 * Docs: https://docs.sepay.vn/tich-hop-webhooks.html
 */

/**
 * Transfer type enum
 */
export type TransferType = 'in' | 'out';

/**
 * SePay webhook payload structure
 * Received when a bank transaction occurs
 */
export interface SePayWebhookPayload {
  /** Transaction ID on SePay system */
  id: number;

  /** Bank brand name (e.g., "Vietcombank", "VPBank") */
  gateway: string;

  /** Transaction date from bank */
  transactionDate: string;

  /** Bank account number */
  accountNumber: string;

  /** Payment code (auto-detected by SePay based on configuration) */
  code: string | null;

  /** Transfer content/description */
  content: string;

  /** Transfer type: "in" for money in, "out" for money out */
  transferType: TransferType;

  /** Transaction amount */
  transferAmount: number;

  /** Account balance (accumulated) */
  accumulated: number;

  /** Sub account (virtual account identifier) */
  subAccount: string | null;

  /** Bank reference code */
  referenceCode: string;

  /** Full bank notification content */
  description: string;
}

/**
 * Response from webhook handler
 */
export interface SePayWebhookResponse {
  success: boolean;
  message: string;
  orderId?: string;
  paymentId?: string;
}
