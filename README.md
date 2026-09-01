# BotBot: Autonomous Agent Payment Marketplace

BotBot is a production-grade, local demonstration of a decentralized, real-time marketplace where autonomous AI agents bid on tasks, negotiate budgets, perform real work via the Groq API, and settle payments on a cryptographic, tamper-evident hash-chain ledger.

## Architecture

The system is built as a complete micro-economy:
- **Orchestrator Bot**: Broadcasts tasks, enforces budgets, collects bids, awards tasks to the cheapest qualified worker, and evaluates results.
- **Worker Bots (x5)**: Each worker operates with a distinct personality (Fast/Cheap, Load-Based, Specialist, Premium, Judge). They are wrapped in rigorous resilience patterns (Token Bucket Rate Limiting, Circuit Breakers) to prevent API spam and cascading failures.
- **Immutable Ledger**: A centralized, append-only SQLite database. Every transaction (holds, releases, refunds) is linked to the previous transaction via a SHA-256 hash. If the database is manually modified, the cryptographic chain breaks.
- **Real-time Pipeline**: All inter-bot communication happens over Redis Pub/Sub (`tasks`, `bids`, `awards`, `results`). The backend Express server bridges these channels via `Socket.IO` directly to the React frontend.
- **Web2 Auth & Mock Mode**: The system uses Web2-style API tokens mapped via environment variables for simplified auth. By default, it runs in `MOCK_MODE=true` to save Groq API tokens.

## Setup & Running

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for Redis)

### 1. Start Infrastructure
```bash
cd backend
docker-compose up -d
```

### 2. Configure Environment
Create a `.env` file in the `backend` directory based on `.env.example`.
```env
MOCK_MODE=true # Set to false and provide real GROQ_API_KEYs to use real LLM requests.
PORT=3000
DEMO_MODE=true # Automates the Orchestrator broadcasting tasks
```

### 3. Start Backend Swarm
```bash
cd backend
npm install
npm run dev
```

### 4. Start React Dashboard
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

## Scripted Demo Sequence

This sequence demonstrates the full capabilities of the marketplace.

1. **Observe the Live Feed**: As the demo loop runs, you will instantly see `TASK_BROADCAST` events followed by a flurry of `BID` events. 
2. **Watch the Roster**: The Sidebar tracks dynamically calculated balances for each bot. You will see balances shift as the Orchestrator drains its budget and workers get paid.
3. **Trigger Tampering (Security Demo)**:
   - Click the "Verify Chain" button on the Ledger panel. It will flash **Green**, indicating the cryptographic chain is valid.
   - Click the red **Tamper (Shield)** icon. This simulates a malicious actor running a SQL `UPDATE` to modify a transaction amount or hash directly in the database.
   - Click "Verify Chain" again. It will instantly flash **Red (409 Conflict)**. The system has cryptographically proven the ledger was compromised.
4. **Observe Resilience (Logs)**:
   - Watch the backend terminal logs. You will occasionally see `Rate limited. Cannot bid.` as the Token Bucket aggressively protects the system from bot spam.
   - If the Groq API fails or times out, you will see Circuit Breaker trip events `(CLOSED -> OPEN)`.

## Technology Stack
- **Backend**: Node.js, TypeScript, Express, SQLite (better-sqlite3), Redis (ioredis), Zod, Socket.IO
- **Frontend**: React, TypeScript, Vite, Socket.IO Client, Vanilla CSS (Glassmorphism)
- **Tooling**: Jest, ESLint
