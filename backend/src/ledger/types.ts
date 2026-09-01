export enum LedgerEntryType {
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  ESCROW_REFUND = 'ESCROW_REFUND',
}

export interface LedgerEntryPayload {
  idempotency_key: string;
  type: LedgerEntryType;
  from_bot_id: string;
  to_bot_id: string;
  amount: number;
  task_id: string;
}

export interface LedgerEntry extends LedgerEntryPayload {
  id: number;
  timestamp: string; // ISO string
  prev_hash: string;
  hash: string;
}

export interface EscrowState {
  taskId: string;
  amount: number;
  fromBotId: string;
  toBotId: string;
  status: 'HELD' | 'RELEASED' | 'REFUNDED';
}
