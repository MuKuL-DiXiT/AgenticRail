# Payment Architecture & Razorpay Flow

```mermaid
sequenceDiagram
    participant User
    participant Agent as AI Buyer Agent
    participant Policy as Policy Engine
    participant Order as Order Service
    participant Razorpay as Razorpay API
    participant Webhook as Webhook Listener
    participant Ledger as Cryptographic Ledger

    User->>Agent: "Buy Nike Pegasus under ₹5,000"
    Agent->>Policy: Evaluate ₹4,999 vs ₹5,000 limit
    Policy-->>Agent: ALLOW (Within autonomous limit)
    Agent->>Order: Create Order (Status: PENDING_PAYMENT)
    Agent->>Razorpay: orders.create({ amount: 499900, currency: "INR" })
    Razorpay-->>Agent: { id: "order_rzp_12345" }
    Agent->>Razorpay: Execute Payment Capture
    Razorpay->>Webhook: Event: payment.captured (HMAC-SHA256 signature)
    Webhook->>Webhook: Verify Signature & Check Idempotency Key
    Webhook->>Order: Update Status -> PAID
    Webhook->>Ledger: Append Entry (SHA-256 Hash Chain)
    Webhook-->>User: Emit Real-Time Socket.IO Audit Event
```

## Idempotency Guarantees
- Every webhook transaction registers an immutable `event_id` in `webhook_events`.
- Duplicate webhooks return `200 OK` with `processed_already: true` and execute 0 duplicate database mutations or ledger entries.

## Cryptographic Hash-Chain Ledger
Every payment capture creates an append-only entry linking `prev_hash` to `hash` calculated using SHA-256:
```json
{
  "id": 1,
  "idempotency_key": "pay_settle_order_1_pay_1",
  "type": "COMMERCE_SETTLEMENT",
  "from_entity": "buyer_agent_001",
  "to_entity": "mch_urbanfit_001",
  "amount_paise": 499900,
  "reference_id": "order_1",
  "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
If any historical record is modified, `verifyChain()` detects the exact broken block.
