# AgentCart Architecture & Design

AgentCart is an end-to-end **Agentic Commerce Platform** targeting **Track 01 — AI Growth & Agentic Commerce**. It makes online merchants discoverable, sellable, and transactable by autonomous AI buyers while guaranteeing financial safety through deterministic policy enforcement and cryptographic auditability.

```mermaid
flowchart TB
    subgraph Client["Frontend (React 19 + TypeScript + Vite)"]
        UI["Conversational Buyer Chat & Dashboard"]
        ManifestUI["Machine-Readable Manifest Inspector"]
        LedgerUI["SHA-256 Ledger & Tamper Detection"]
    end

    subgraph CoreEngine["AgentCart Core Services (Express + TypeScript)"]
        ManifestAPI["Manifest Service (/api/merchants/:id/agent-manifest)"]
        CatalogAPI["Catalog & Semantic Search"]
        GrowthEngine["Upsell & Growth Recommendation Engine"]
        PolicyEngine["Deterministic Policy Engine (ALLOW / DENY / CONFIRM)"]
        OrderSvc["Cart & Order Service"]
        PaymentSvc["Razorpay Test Mode & Webhook Verifier"]
    end

    subgraph AgentLayer["Agentic Layer"]
        BuyerAgent["LangGraph-Style State-Machine Buyer Agent"]
        AgentTools["Strictly-Scoped Tool Calling (No Raw DB/Money Access)"]
    end

    subgraph Storage["Source of Truth & Cryptography"]
        DB[("SQLite Database\n(WAL Mode)")]
        Ledger[("Tamper-Evident SHA-256\nHash-Chain Ledger")]
        Webhooks[("Idempotent Webhook Registry")]
    end

    UI <-->|REST + WebSockets| CoreEngine
    BuyerAgent <-->|Structured Intent| AgentTools
    AgentTools --> CatalogAPI
    AgentTools --> GrowthEngine
    AgentTools --> PolicyEngine
    AgentTools --> OrderSvc
    AgentTools --> PaymentSvc

    PolicyEngine --> DB
    PaymentSvc --> Ledger
    PaymentSvc --> Webhooks
    LedgerUI --> Ledger
```

## Core Invariant: NEVER Allow LLM to Directly Control Money
1. The LLM or Buyer Agent reasons and produces a structured intent.
2. The Deterministic Policy Layer validates the requested amount, categories, and cumulative daily budget.
3. If allowed, an Order is created and a Razorpay transaction is initialized.
4. Razorpay Webhooks verify signatures cryptographically and process events idempotently.
5. All completed settlements are appended to a SHA-256 hash-chain ledger.

## Monorepo Layout
- `backend/`: Express, TypeScript, better-sqlite3, Razorpay SDK, Socket.IO.
- `frontend/`: React 19, TypeScript, Vite, Lucide Icons, Glassmorphism CSS.
- `docs/`: Complete technical architecture and demo flow documentation.
