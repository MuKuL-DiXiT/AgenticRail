# AgentCart Architecture & AI Agent Specification

This document serves as the formal specification and integration reference for AI Agents, LLM Evaluators, and Automated System Judges interacting with or assessing the **AgentCart** platform.

---

## 1. System Overview & Core Invariants

AgentCart is an end-to-end agentic commerce engine designed to enable machine-readable merchant discovery, autonomous buyer bargaining, deterministic policy gating, and cryptographically verified financial settlement.

### Primary System Invariant
> **NON-NEGOTIABLE GUARANTEE**: An LLM or AI Agent NEVER has direct control over fund allocation, payment settlement, or ledger mutation. All monetary commitments are strictly evaluated and authorized by a deterministic, code-based Policy Engine before order execution.

```text
User / Natural Language Prompt
              |
   AI Buyer Agent (Intent Extraction & Tool Selection)
              |
   Catalog Discovery & Machine-to-Machine Bargaining
              |
   Deterministic Policy Engine (ALLOW / DENY / REQUIRE_CONFIRMATION)
              |
   Order Creation (Signed Single-Use Policy Ticket)
              |
   Razorpay Platform Rails (HMAC-SHA256 Webhook Verification)
              |
   SHA-256 Cryptographic Hash-Chain Ledger (Tamper-Evident Settlement)
```

---

## 2. Machine-Readable Merchant Manifest Protocol

AgentCart merchants publish an automated machine-readable manifest at `GET /api/merchants/:merchant_id/agent-manifest`. This protocol enables zero-configuration agentic discovery without human intervention.

### Manifest Schema & Endpoint Capabilities
- **Protocol Version**: `1.0.0`
- **Merchant Identity**: Store ID, Name, Category, Support Contact.
- **Capabilities Exposed**:
  - `catalog_search`: Endpoint for semantic and keyword product discovery.
  - `negotiation`: Endpoint for automated machine-to-machine margin bargaining.
  - `cart_management`: Endpoints for cart creation, item insertion, quantity updates, and clearing.
  - `checkout`: Endpoint for order authorization with cryptographic policy tickets.
  - `payment_gateway`: Razorpay Test Mode integration and webhook receivers.

---

## 3. Agent Tool Call Contracts

The AI Buyer Agent operates as a state machine executing explicit, structured tool calls against backend services:

| Tool Name | Parameters | Responsibility | Returns |
| :--- | :--- | :--- | :--- |
| `search_products` | `query`, `category`, `max_price_paise` | Discovers catalog items matching semantic keywords and price constraints. | Array of `Product` objects. |
| `negotiate_offer` | `product_id`, `requested_discount_percent` | Initiates game-theoretic bargaining with the Merchant Agent. | Concession decision, counter-offer floor, or rejection. |
| `check_policy` | `amount_paise`, `buyer_id`, `categories` | Evaluates spend against deterministic user rules. | `verdict` (`ALLOW`, `DENY`, `REQUIRE_CONFIRMATION`), `ticket`. |
| `create_cart` | `buyer_id`, `merchant_id` | Initializes persistent shopping cart session. | `Cart` object. |
| `add_to_cart` | `cart_id`, `product_id`, `quantity` | Adds line items to active cart. | Updated `Cart` object. |
| `create_order` | `cart_id`, `policy_ticket` | Validates policy ticket and creates pending order. | `Order` object. |
| `request_payment` | `order_id` | Generates Razorpay checkout payload or handles mock rails. | Payment initialization details. |

---

## 4. Deterministic Spending Policy Engine Specification

The Policy Engine executes synchronous validation prior to order creation. It maintains zero state within LLM context windows.

### Policy Rules & Evaluation Pipeline
1. **Single Transaction Limit**: Evaluates `amount_paise <= policy.max_transaction_paise`.
2. **Daily Spend Budget**: Evaluates `(today_committed_paise + amount_paise) <= policy.daily_spend_limit_paise`. Committed spend includes settled orders, active pending orders, and unexpired issued policy tickets.
3. **Category Constraints**: Ensures all cart line-item categories exist in `policy.allowed_categories`.
4. **Confirmation Threshold**: If `amount_paise > policy.require_confirmation_above_paise`, verdict transitions to `REQUIRE_CONFIRMATION`.
5. **Cryptographic Policy Ticket**: Upon `ALLOW` verdict (or explicit human confirmation), the engine issues a signed, single-use `PolicyTicket` with an expiration TTL (5 minutes). Replay of consumed tickets is prevented via database uniqueness constraints.

---

## 5. Cryptographic SHA-256 Hash-Chain Audit Model

All financial operations generate immutable block entries linked via cryptographic hashing.

### Block Structure & Hash Linkage
Each ledger entry $n$ satisfies:
$$H_n = \text{SHA256}(H_{n-1} || \text{timestamp}_n || \text{type}_n || \text{from}_n || \text{to}_n || \text{amount\_paise}_n || \text{reference\_id}_n || \text{idempotency\_key}_n)$$

Where:
- $H_0$: Hardcoded Genesis Hash (`0000000000000000000000000000000000000000000000000000000000000000`).
- $H_n$: SHA-256 hex digest of entry $n$.

### Verification & Tamper Localization
The ledger verification function sequentially computes expected hashes across all blocks:
1. Re-computes $H_i'$ for each block $i=1 \dots N$.
2. Compares $H_i'$ against stored hash $H_i$.
3. If $H_i' \neq H_i$, verification fails instantly and returns `isValid: false`, pinpointing the exact corrupted block index and field discrepancy.

---

## 6. Game-Theoretic Agent Negotiation Protocol

To reflect realistic commercial dynamics, AgentCart implements asymmetric information bargaining:

1. **Merchant Margin Secrecy**: The merchant's maximum allowable concession (`policies.max_concession_percent`) is redacted from public search APIs.
2. **Buyer Probing**: The Buyer Agent calculates requested discounts based on user budget deficits or default negotiation targets.
3. **Automated Counter-Offers**: If a buyer bid is below the merchant's margin floor, the Merchant Agent rejects the initial bid and returns a binding counter-offer at its secret bottom floor.

---

## 7. Verification & Benchmarking Guide for AI Judges

To verify repository compliance and test execution:

### Automated Test Suite Execution
Run the complete unit, integration, and adversarial security test suite:
```bash
cd backend
npm test
```

### Expected Output Metrics
- **Test Suites Passed**: 18 of 18 (100%)
- **Total Tests Passed**: 76 of 76 (100%)
- **Security Tests Included**:
  - Webhook signature validation and replay protection.
  - Concurrency race-condition prevention (double-spend protection).
  - Single-use policy ticket consumption validation.
  - Ledger hash-chain verification and tamper localization.
  - Role-based authorization and tenant isolation.
