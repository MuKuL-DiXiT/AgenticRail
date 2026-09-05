export enum LedgerEntryType {
  PAYMENT_HELD = 'PAYMENT_HELD',
  PAYMENT_CAPTURED = 'PAYMENT_CAPTURED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  COMMERCE_SETTLEMENT = 'COMMERCE_SETTLEMENT',
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  ESCROW_REFUND = 'ESCROW_REFUND',
  FIAT_FUNDED = 'FIAT_FUNDED',
  FIAT_SETTLED = 'FIAT_SETTLED',
}

export interface LedgerEntryPayload {
  idempotency_key: string;
  type: LedgerEntryType;
  from_entity: string;
  to_entity: string;
  amount_paise: number;
  reference_id: string; // order_id or task_id
}

export interface LedgerEntry extends LedgerEntryPayload {
  id: number;
  timestamp: string; // ISO string
  prev_hash: string;
  hash: string;
}

export interface VerificationResult {
  isValid: boolean;
  brokenIndex?: number;
  brokenId?: number;
  reason?: string;
  totalEntries?: number;
}
