import { createHash } from 'crypto';
import { getDb } from './db';
import { LedgerEntry, LedgerEntryPayload, LedgerEntryType } from './types';

// The genesis block's previous hash
export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

/**
 * Deterministically serializes a payload for hashing.
 * The order of fields must be guaranteed for reproducible hashes.
 */
function serializeForHash(
  prevHash: string,
  timestamp: string,
  payload: LedgerEntryPayload
): string {
  // We use a strict JSON stringify ordering to prevent property reordering attacks/bugs
  const orderedObj = {
    amount: payload.amount,
    from_bot_id: payload.from_bot_id,
    idempotency_key: payload.idempotency_key,
    prev_hash: prevHash,
    task_id: payload.task_id,
    timestamp: timestamp,
    to_bot_id: payload.to_bot_id,
    type: payload.type,
  };
  return JSON.stringify(orderedObj);
}

function calculateHash(prevHash: string, timestamp: string, payload: LedgerEntryPayload): string {
  const data = serializeForHash(prevHash, timestamp, payload);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Append an entry to the ledger.
 * This function enforces idempotency, state machine transitions, and tamper-evident chaining.
 */
export function appendEntry(payload: LedgerEntryPayload): LedgerEntry {
  const db = getDb();

  // 1. Check for Idempotency
  const existing = db
    .prepare('SELECT * FROM ledger WHERE idempotency_key = ?')
    .get(payload.idempotency_key) as LedgerEntry | undefined;

  if (existing) {
    return existing; // Return the existing entry if we've already processed this idempotency_key
  }

  // Use an IMMEDIATE transaction to prevent deadlocks during high-concurrency WAL writes
  const tx = db.transaction(() => {
    // 2. Validate Escrow State Machine Transitions
    const taskEntries = db
      .prepare('SELECT * FROM ledger WHERE task_id = ? ORDER BY id ASC')
      .all(payload.task_id) as LedgerEntry[];

    let currentState: 'HELD' | 'RELEASED' | 'REFUNDED' | null = null;
    let holdAmount = 0;

    for (const entry of taskEntries) {
      if (entry.type === LedgerEntryType.ESCROW_HOLD) {
        if (currentState !== null) throw new LedgerError('Task already has an ESCROW_HOLD');
        currentState = 'HELD';
        holdAmount = entry.amount;
      } else if (entry.type === LedgerEntryType.ESCROW_RELEASE) {
        if (currentState !== 'HELD') throw new LedgerError('Cannot release without a HOLD state');
        currentState = 'RELEASED';
      } else if (entry.type === LedgerEntryType.ESCROW_REFUND) {
        if (currentState !== 'HELD') throw new LedgerError('Cannot refund without a HOLD state');
        currentState = 'REFUNDED';
      }
    }

    if (payload.type === LedgerEntryType.ESCROW_HOLD) {
      if (currentState !== null) {
        throw new LedgerError('Invalid transition: ESCROW_HOLD on already existing task');
      }
    } else if (payload.type === LedgerEntryType.ESCROW_RELEASE) {
      if (currentState !== 'HELD') {
        throw new LedgerError('Invalid transition: ESCROW_RELEASE requires HELD state');
      }
      if (payload.amount !== holdAmount) {
        throw new LedgerError('Release amount must match hold amount');
      }
    } else if (payload.type === LedgerEntryType.ESCROW_REFUND) {
      if (currentState !== 'HELD') {
        throw new LedgerError('Invalid transition: ESCROW_REFUND requires HELD state');
      }
      if (payload.amount !== holdAmount) {
        throw new LedgerError('Refund amount must match hold amount');
      }
    } else {
      throw new LedgerError(`Unknown LedgerEntryType: ${payload.type}`);
    }

    // 3. Compute Chain Hash
    const lastEntry = db.prepare('SELECT * FROM ledger ORDER BY id DESC LIMIT 1').get() as
      LedgerEntry | undefined;

    const prevHash = lastEntry ? lastEntry.hash : GENESIS_PREV_HASH;
    const timestamp = new Date().toISOString();
    const hash = calculateHash(prevHash, timestamp, payload);

    // 4. Insert
    const stmt = db.prepare(`
      INSERT INTO ledger (
        idempotency_key, timestamp, type, from_bot_id, to_bot_id, amount, task_id, prev_hash, hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      payload.idempotency_key,
      timestamp,
      payload.type,
      payload.from_bot_id,
      payload.to_bot_id,
      payload.amount,
      payload.task_id,
      prevHash,
      hash
    );

    const inserted = db
      .prepare('SELECT * FROM ledger WHERE id = ?')
      .get(result.lastInsertRowid) as LedgerEntry;

    return inserted;
  });
  
  return tx.immediate();
}

export interface VerificationResult {
  isValid: boolean;
  brokenIndex?: number;
  brokenId?: number;
  reason?: string;
}

/**
 * Verify the cryptographic integrity of the entire chain.
 */
export function verifyChain(): VerificationResult {
  const db = getDb();
  // Fetch everything. For production with millions of rows, we'd use a cursor.
  const allEntries = db.prepare('SELECT * FROM ledger ORDER BY id ASC').all() as LedgerEntry[];

  let expectedPrevHash = GENESIS_PREV_HASH;

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];

    // 1. Check prev_hash links
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenIndex: i,
        brokenId: entry.id,
        reason: `prev_hash mismatch: expected ${expectedPrevHash}, found ${entry.prev_hash}`,
      };
    }

    // 2. Check the hash itself
    const computedHash = calculateHash(entry.prev_hash, entry.timestamp, {
      idempotency_key: entry.idempotency_key,
      type: entry.type as LedgerEntryType,
      from_bot_id: entry.from_bot_id,
      to_bot_id: entry.to_bot_id,
      amount: entry.amount,
      task_id: entry.task_id,
    });

    if (computedHash !== entry.hash) {
      return {
        isValid: false,
        brokenIndex: i,
        brokenId: entry.id,
        reason: `hash mismatch: calculated ${computedHash}, found ${entry.hash}`,
      };
    }

    expectedPrevHash = entry.hash;
  }

  return { isValid: true };
}

/**
 * Replay the ledger to derive the current balance of a given bot.
 */
export function getBalance(botId: string): number {
  const db = getDb();
  // In a real system we'd snapshot this periodically, but for rigor here we replay.
  const entries = db.prepare('SELECT * FROM ledger ORDER BY id ASC').all() as LedgerEntry[];

  let balance = 0;

  // NOTE: In this design, only the Orchestrator starts with a positive budget, initialized at boot.
  // Wait, the orchestrator needs to pay out. For this system, we don't start with a genesis mint for the orchestrator,
  // we just track net flow. We can add a starting balance from ENV if it's the orchestrator.
  // The requirements say: "ORCHESTRATOR_STARTING_BUDGET=1000" in .env. We'll handle that offset at the API layer,
  // or we can handle it here if botId === 'orchestrator'. Let's just calculate net flow here.

  for (const entry of entries) {
    if (entry.type === LedgerEntryType.ESCROW_HOLD) {
      if (entry.from_bot_id === botId) {
        balance -= entry.amount; // Funds are locked from the sender's perspective
      }
    } else if (entry.type === LedgerEntryType.ESCROW_RELEASE) {
      if (entry.to_bot_id === botId) {
        balance += entry.amount; // Funds are received by the worker
      }
    } else if (entry.type === LedgerEntryType.ESCROW_REFUND) {
      if (entry.from_bot_id === botId) {
        balance += entry.amount; // Funds are returned to the sender
      }
    }
  }

  return balance;
}

/**
 * Internal helper for corrupting a record to demonstrate tamper detection.
 */
export function _corruptEntryForDemo(id: number, field: string, newValue: string | number): void {
  const db = getDb();
  db.prepare(`UPDATE ledger SET ${field} = ? WHERE id = ?`).run(newValue, id);
}
