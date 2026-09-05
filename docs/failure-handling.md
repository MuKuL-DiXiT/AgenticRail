# Graceful Failure Handling & Recovery

AgentCart implements explicit, deterministic failure handling. It is designed to satisfy the core rule: **Never blindly retry money movements**.

## Failure Simulation Mode
- A toggle button in the UI (`/api/demo/toggle-failure`) enables deterministic failure simulation.
- When enabled, payment authorization fails gracefully with an explicit provider decline reason.

```text
Payment Attempt
       ↓
Simulated Failure / Bank Card Declined
       ↓
Transaction State marked FAILED
       ↓
Order Status updated to PAYMENT_FAILED
       ↓
Agent receives failure event
       ↓
Agent explains reason to user
       ↓
User receives safe recovery options (Retry / Modify Cart / Alternate Rail)
```

## Security Invariants
- **No Duplicate Charges**: A failed payment does NOT deduct from the buyer's balance or append a settlement entry to the ledger.
- **Safe Recovery**: The order remains in `PAYMENT_FAILED` state, allowing intentional user-approved retries without creating orphaned orders.
