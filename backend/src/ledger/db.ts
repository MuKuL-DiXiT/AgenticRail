import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initDb(dbPath: string = ':memory:'): Database.Database {
  db = new Database(dbPath, { timeout: 5000 }); // Handle SQLITE_BUSY gracefully
  
  // Enable Write-Ahead Logging for high concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Create ledger table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      from_bot_id TEXT NOT NULL,
      to_bot_id TEXT NOT NULL,
      amount REAL NOT NULL,
      task_id TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    )
  `);

  // Create an index for idempotency_key for fast lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_idempotency_key ON ledger(idempotency_key)`);
  // Create an index for faster history reconstruction if needed
  db.exec(`CREATE INDEX IF NOT EXISTS idx_task_id ON ledger(task_id)`);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
