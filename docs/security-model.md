# AgentCart Security Model & Threat Analysis

This document provides a technical audit of the security controls, cryptographic invariants, and threat mitigations implemented across **AgentCart**.

---

## Security Threat Matrix

| Threat Category | Potential Attack Vector | System Defense Mechanism | Architectural Invariant |
| :--- | :--- | :--- | :--- |
| **Prompt Injection** | User manipulates LLM into skipping policy checks or spending funds directly. | LLM has zero direct financial authority; all payments require deterministic code-based `PolicyEngine` authorization tickets. | Non-LLM money control boundary. |
| **Double Spending** | Rapid concurrent checkout requests trying to bypass daily spending caps. | Committed spend query counts settled payments + pending orders + active policy tickets within a single SQLite WAL transaction. | Concurrency-safe budget tracking. |
| **Ticket Replay** | Reusing a valid `PolicyTicket` across multiple orders. | Single-use consumption table (`policy_tickets`) marks tickets as `CONSUMED` during order creation inside an atomic transaction. | Replay protection. |
| **Ledger Tampering** | Direct SQL mutation of historical ledger balances or transaction records. | SHA-256 hash-chain block linkage ($H_n = \text{SHA256}(H_{n-1} \dots)$); any modification breaks all downstream hashes and is localized immediately by `verifyLedgerIntegrity()`. | Cryptographic tamper evidence. |
| **Webhook Spoofing** | Adversary posts fake `payment.captured` webhooks to credit orders. | HMAC-SHA256 signature verification (`X-Razorpay-Signature`) against secret key; mandatory timestamp replay checks. | Cryptographic payment verification. |
| **Webhook Replay** | Re-sending valid captured webhook payloads to duplicate order settlement. | Webhook registry table tracks processed event IDs; duplicate events are discarded idempotently (`200 OK` without ledger duplicate). | Idempotence invariant. |
| **Information Leakage** | Buyer probing API to extract merchant minimum margin limits. | `policies.max_concession_percent` is redacted from public search APIs; bargaining relies on game-theoretic blind probing. | Asymmetric margin confidentiality. |

---

## Cryptographic Guarantees

### 1. Single-Use Signed Policy Tickets
When the Policy Engine approves a cart, it generates a cryptographically signed ticket:
```typescript
interface PolicyTicket {
  ticket_id: string;
  buyer_id: string;
  cart_id: string;
  amount_paise: number;
  verdict: 'ALLOW';
  issued_at: string;
  expires_at: string;
  signature: string; // HMAC-SHA256(ticket_payload, SECRET)
}
```
During `createOrder`, the database validates signature authenticity, expiration timestamp, and single-use status before persisting the order.

### 2. Hash-Chain Ledger Linkage
The audit ledger uses chained cryptographic hashes to achieve tamper-evidence equivalent to a permissioned blockchain:

$$H_0 = \text{0000000000000000000000000000000000000000000000000000000000000000}$$
$$H_n = \text{SHA256}(H_{n-1} || \text{idempotency\_key} || \text{type} || \text{from} || \text{to} || \text{amount\_paise} || \text{reference\_id} || \text{timestamp})$$

Any modification to historical block $k$ ($0 < k < n$) invalidates hashes $H_k \dots H_n$, making unauthorized modification mathematically detectable.
