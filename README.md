# AgentCart — End-to-End Agentic Commerce Platform

> **TRACK 01 — AI Growth & Agentic Commerce**
> 
> Empowering merchants to become discoverable, sellable, and transactable by autonomous AI buyers end-to-end.

AgentCart bridges machine-readable merchant capabilities with state-machine AI buyers, bounded deterministic spending policies, Razorpay Test Mode checkout, idempotent webhooks, and a tamper-evident SHA-256 cryptographic audit ledger.

---

## Technical Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend Dashboard (React 19 + TypeScript)"]
        UI["Conversational AI Buyer Chat"]
        ManifestUI["Machine-Readable Manifest Inspector"]
        LedgerUI["SHA-256 Ledger & Tamper Detection"]
    end

    subgraph CoreEngine["AgentCart Backend (Express + TypeScript)"]
        ManifestAPI["Manifest API (/api/merchants/:id/agent-manifest)"]
        CatalogAPI["Catalog & Semantic Search"]
        GrowthEngine["Upsell & Growth Recommendation Engine"]
        PolicyEngine["Deterministic Policy Engine (ALLOW / DENY / CONFIRM)"]
        OrderSvc["Cart & Order Service"]
        PaymentSvc["Razorpay Test Mode & Webhook Signature Verifier"]
    end

    subgraph Storage["Source of Truth & Cryptography"]
        DB[("SQLite Database\n(WAL Mode)")]
        Ledger[("Tamper-Evident SHA-256\nHash-Chain Ledger")]
        Webhooks[("Idempotent Webhook Registry")]
    end

    UI <-->|REST + Socket.IO| CoreEngine
    CoreEngine --> DB
    CoreEngine --> Ledger
    CoreEngine --> Webhooks
```

---

## Core Invariant: LLM Money Control Isolation

```text
User / Natural Language Prompt
              |
   AI Buyer Agent (Intent)
              |
   Catalog Discovery & Machine Bargaining
              |
  Deterministic Policy Engine (ALLOW / DENY / REQUIRE_CONFIRMATION)
              |
     Order Authorization (Signed Single-Use Policy Ticket)
              |
   Razorpay Test Mode Payment Rails
              |
   Signature-Verified Webhook (Idempotent)
              |
  SHA-256 Cryptographic Ledger Entry
```

---

## Role-Based Authentication & Seeded Demo Credentials

AgentCart features real database-backed authentication with password hashing (`bcryptjs`), cryptographic session verification (`JWT`), and multi-tenant data isolation:

| Role | Email | Password | Account Details & Capabilities |
| :--- | :--- | :--- | :--- |
| **BUYER** | `rahul@runner.ai` | `password123` | Autonomous AI shopper, semantic keyword search, dynamic machine-to-machine bargaining, personal spending policy caps, persisted cart & Razorpay checkout. |
| **MERCHANT** | `merchant@urbanfit.ai` | `password123` | Store manager (`mch_urbanfit_001`), Cloudinary product & inventory publishing, live database revenue analytics, concession limits, machine-readable manifest inspector. |

Users can also register new accounts dynamically with full role assignment and automatic spending policy or merchant store provisioning.

---

## Razorpay Platform Rails Configuration

For this hackathon implementation:
- Razorpay credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) are configured as platform infrastructure parameters in the backend `.env`.
- Both Buyer and Merchant flows share this single Razorpay Test Mode platform account while maintaining strict separation at the application and database layers.
- Secret keys and webhook signing secrets reside exclusively on the backend server and are never exposed to frontend clients.

---

## Quickstart & Environment Setup

### 1. Prerequisites
- Node.js 18+
- npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Seed Database
```bash
npm run seed
```
Creates persistent SQLite tables, seeds catalog items & variants, initializes spending policies, and provisions both demo accounts (`rahul@runner.ai` and `merchant@urbanfit.ai`).

### 4. Run Backend & Frontend Concurrently
```bash
npm run dev
```
- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:4000](http://localhost:4000)
- **Machine-Readable Manifest:** [http://localhost:4000/api/merchants/mch_urbanfit_001/agent-manifest](http://localhost:4000/api/merchants/mch_urbanfit_001/agent-manifest)

---

## Running Automated Tests

```bash
npm test
```
Executes all 18 Jest test suites covering 76 individual tests:
- Real role-based authentication, registration, login, and tenant isolation.
- Deterministic Policy Engine limits, category rules, and concurrency race-condition prevention.
- Razorpay webhook signature verification, replay protection, and idempotency.
- Cryptographic hash-chain ledger integrity, block validation, and tamper localization.
- End-to-end conversational agent negotiation and checkout state machine.

---

## Live Hackathon Walkthrough

1. **Merchant Machine-Readable Manifest**:
   - Go to **"Merchant Catalog & Manifest"** to inspect the JSON manifest exposing catalog search, inventory, cart creation, and checkout endpoints.
2. **Conversational Shopping**:
   - Go to **"AI Buyer & Chat"** and type: `I need running shoes for under ₹5,000`.
   - The agent discovers 3 products, selects **Nike Air Zoom Pegasus 40** (₹4,999), offers an intelligent upsell (**Dri-FIT Socks ₹499**), and checks the spending policy.
3. **Policy Approval & Checkout**:
   - The Policy Engine validates the ₹4,999 cart against the ₹5,000 autonomous limit (`ALLOW`).
   - The agent executes a Razorpay Test Mode checkout and settles the payment onto the ledger.
4. **Cryptographic Tamper-Evidence**:
   - Click **"Verify Ledger"** -> Displays **Chain Verified**.
   - Click **"Tamper (Demo)"** to simulate malicious database corruption -> Run **"Verify Ledger"** -> Displays **Tamper Detected** with localizing details!
5. **Graceful Failure Handling**:
   - Toggle **"Failure Mode Active"** in the top bar to demonstrate safe recovery without duplicate charges.

---

## Technical Documentation Suite

- [Agent Specification & AI Judge Guide](AGENT.md)
- [Architecture & Design](docs/architecture.md)
- [Agent Flow & State Machine](docs/agent-flow.md)
- [Payment & Razorpay Flow](docs/payment-flow.md)
- [Deterministic Policy Engine](docs/policy-engine.md)
- [Cryptographic Audit Model](docs/audit-model.md)
- [Security Model & Threat Analysis](docs/security-model.md)
- [REST API Specification](docs/api-spec.md)
- [Failure Handling & Recovery](docs/failure-handling.md)
- [Hackathon Demo Script](docs/demo-script.md)
- [Progress & Benchmark Log](docs/progress.md)
