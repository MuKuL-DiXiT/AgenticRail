# BotBot - Bot-to-Bot Payment Marketplace

![CI](https://github.com/mukuldixit/BotBot/actions/workflows/ci.yml/badge.svg)

This repository is a production-grade implementation of a bot-to-bot payment marketplace.
It orchestrates tasks via pub/sub to worker bots (powered by Groq), negotiates pricing, 
and logs every transaction in a cryptographically verifiable internal ledger.

## Quickstart

1. Add your 6 Groq API keys to `.env` (see `.env.example`), then set `MOCK_MODE=false`.
2. Install dependencies: `npm install`
3. Run the development environment: `npm run dev`

## Architecture & Design Decisions

### The Ledger (Tamper-Evident Hash Chain)

**Why hash-chaining?**
The core requirement is cryptographic verifiability of a centralized ledger. It is **not** a blockchain, and this system does not claim Byzantine fault tolerance or distributed consensus. Instead, it is a single-writer, append-only, tamper-evident log modeled on immutable audit logs. Each transaction contains a SHA-256 hash of its contents combined with the hash of the previous transaction (`prev_hash`). This ensures that any modification to historical data is detectable and localizable.

**Derived Balances:**
Balances are never stored as independently mutable fields. Stored balances are a common source of race conditions and drift. Instead, the balance for any bot is derived entirely by replaying the ledger history (holds, releases, refunds). 

### Idempotency Model
Following production payment APIs (like Stripe), every ledger operation carries an `idempotency_key`. The ledger enforces that duplicate submissions for the same key yield the exact same historical record and result in exactly one ledger effect. This makes the system resilient to network retries.

### Authorization Model
In this implementation, the worker bots are authenticated using pre-shared API keys (tokens). The pub/sub system and orchestrator validate this token before accepting a bid. This is a deliberately simple stand-in for a real trust/identity layer. A real production version might incorporate PKI-based cryptographic signatures and robust key rotation.

### Resilience Model
External calls (e.g., to the Groq API) are wrapped with timeouts and circuit breakers. If a worker bot fails repeatedly, the circuit breaker trips, protecting the orchestrator from stalling, enforcing backpressure, and maintaining overall system health. 

## Project Structure
- `backend/`: Node.js, TypeScript, SQLite (Ledger), Express (API), Socket.IO
- `frontend/`: React, Vite, TailwindCSS (Dashboard)
