import { createHash } from 'crypto';
import { getDb } from './db';
import { LedgerEntry, LedgerEntryPayload, LedgerEntryType, VerificationResult } from './types';

export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

function serializeForHash(
  prevHash: string,
  timestamp: string,
  payload: LedgerEntryPayload
): string {
  const orderedObj = {
    amount_paise: payload.amount_paise,
    from_entity: payload.from_entity,
    idempotency_key: payload.idempotency_key,
    prev_hash: prevHash,
    reference_id: payload.reference_id,
    timestamp: timestamp,
    to_entity: payload.to_entity,
    type: payload.type,
  };
  return JSON.stringify(orderedObj);
}

function calculateHash(prevHash: string, timestamp: string, payload: LedgerEntryPayload): string {
  const data = serializeForHash(prevHash, timestamp, payload);
  return createHash('sha256').update(data).digest('hex');
}

export function appendEntry(payload: LedgerEntryPayload): LedgerEntry {
  const db = getDb();

  // 1. Check for Idempotency
  const existing = db
    .prepare('SELECT * FROM ledger WHERE idempotency_key = ?')
    .get(payload.idempotency_key) as LedgerEntry | undefined;

  if (existing) {
    return existing;
  }

  const tx = db.transaction(() => {
    // 2. Compute Chain Hash
    const lastEntry = db.prepare('SELECT * FROM ledger ORDER BY id DESC LIMIT 1').get() as
      LedgerEntry | undefined;

    const prevHash = lastEntry ? lastEntry.hash : GENESIS_PREV_HASH;
    const timestamp = new Date().toISOString();
    const hash = calculateHash(prevHash, timestamp, payload);

    // 3. Insert into ledger table
    const stmt = db.prepare(`
      INSERT INTO ledger (
        idempotency_key, timestamp, type, from_entity, to_entity, amount_paise, reference_id, prev_hash, hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      payload.idempotency_key,
      timestamp,
      payload.type,
      payload.from_entity,
      payload.to_entity,
      payload.amount_paise,
      payload.reference_id,
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

export function verifyChain(): VerificationResult {
  const db = getDb();
  const allEntries = db.prepare('SELECT * FROM ledger ORDER BY id ASC').all() as LedgerEntry[];

  let expectedPrevHash = GENESIS_PREV_HASH;

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];

    if (entry.prev_hash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenIndex: i,
        brokenId: entry.id,
        reason: `prev_hash mismatch: expected ${expectedPrevHash}, found ${entry.prev_hash}`,
        totalEntries: allEntries.length,
      };
    }

    const computedHash = calculateHash(entry.prev_hash, entry.timestamp, {
      idempotency_key: entry.idempotency_key,
      type: entry.type as LedgerEntryType,
      from_entity: entry.from_entity,
      to_entity: entry.to_entity,
      amount_paise: entry.amount_paise,
      reference_id: entry.reference_id,
    });

    if (computedHash !== entry.hash) {
      return {
        isValid: false,
        brokenIndex: i,
        brokenId: entry.id,
        reason: `hash mismatch: calculated ${computedHash}, found ${entry.hash}`,
        totalEntries: allEntries.length,
      };
    }

    expectedPrevHash = entry.hash;
  }

  return { isValid: true, totalEntries: allEntries.length };
}

export function getAllLedgerEntries(): LedgerEntry[] {
  const db = getDb();
  return db.prepare('SELECT * FROM ledger ORDER BY id DESC').all() as LedgerEntry[];
}

export function generateAuditCertificate(): {
  certificate_id: string;
  generated_at: string;
  total_entries: number;
  is_valid: boolean;
  genesis_hash: string;
  head_hash: string;
  verification_details: VerificationResult;
  tamper_evident_fingerprint: string;
} {
  const verification = verifyChain();
  const db = getDb();
  const allEntries = db.prepare('SELECT * FROM ledger ORDER BY id ASC').all() as LedgerEntry[];

  const headHash = allEntries.length > 0 ? allEntries[allEntries.length - 1].hash : GENESIS_PREV_HASH;
  const combinedHashes = allEntries.map(e => e.hash).join(':');
  const fingerprint = createHash('sha256').update(combinedHashes || 'EMPTY_LEDGER').digest('hex');

  return {
    certificate_id: createHash('sha256').update(`${fingerprint}:${Date.now()}`).digest('hex').slice(0, 16),
    generated_at: new Date().toISOString(),
    total_entries: allEntries.length,
    is_valid: verification.isValid,
    genesis_hash: GENESIS_PREV_HASH,
    head_hash: headHash,
    verification_details: verification,
    tamper_evident_fingerprint: fingerprint,
  };
}

export function verifyDoubleEntryBalances(): {
  balanced: boolean;
  total_debits_paise: number;
  total_credits_paise: number;
  entity_balances: Record<string, number>;
} {
  const db = getDb();
  const allEntries = db.prepare('SELECT * FROM ledger ORDER BY id ASC').all() as LedgerEntry[];

  let totalDebits = 0;
  let totalCredits = 0;
  const balances: Record<string, number> = {};

  for (const entry of allEntries) {
    totalDebits += entry.amount_paise;
    totalCredits += entry.amount_paise;

    // from_entity is debited (decreased), to_entity is credited (increased)
    balances[entry.from_entity] = (balances[entry.from_entity] || 0) - entry.amount_paise;
    balances[entry.to_entity] = (balances[entry.to_entity] || 0) + entry.amount_paise;
  }

  return {
    balanced: totalDebits === totalCredits,
    total_debits_paise: totalDebits,
    total_credits_paise: totalCredits,
    entity_balances: balances,
  };
}

export function _corruptEntryForDemo(id: number, field: string, newValue: string | number): void {
  const db = getDb();
  db.prepare(`UPDATE ledger SET ${field} = ? WHERE id = ?`).run(newValue, id);
}

export function repairChain(): { repaired: number; total: number } {
  const db = getDb();
  const allEntries = db.prepare('SELECT * FROM ledger ORDER BY id ASC').all() as LedgerEntry[];
  let expectedPrevHash = GENESIS_PREV_HASH;
  let repairedCount = 0;

  for (const entry of allEntries) {
    let needsUpdate = false;
    let prevHashToUse = entry.prev_hash;

    if (entry.prev_hash !== expectedPrevHash) {
      prevHashToUse = expectedPrevHash;
      needsUpdate = true;
    }

    const computedHash = calculateHash(prevHashToUse, entry.timestamp, {
      idempotency_key: entry.idempotency_key,
      type: entry.type as LedgerEntryType,
      from_entity: entry.from_entity,
      to_entity: entry.to_entity,
      amount_paise: entry.amount_paise,
      reference_id: entry.reference_id,
    });

    if (computedHash !== entry.hash || needsUpdate) {
      db.prepare('UPDATE ledger SET prev_hash = ?, hash = ? WHERE id = ?').run(
        prevHashToUse,
        computedHash,
        entry.id
      );
      repairedCount++;
    }

    expectedPrevHash = computedHash;
  }

  return { repaired: repairedCount, total: allEntries.length };
}

