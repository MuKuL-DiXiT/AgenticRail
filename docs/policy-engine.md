# Deterministic Policy Engine

The **Policy Engine** is the deterministic gatekeeper that isolates the AI Agent from actual money movement.

## Evaluation Rules
1. **Category Whitelist**: Checks if all cart product categories are in `allowed_categories` (e.g. `['footwear', 'apparel', 'gear', 'nutrition']`).
2. **Hard Transaction Ceiling**: If `amount_paise > max_transaction_paise`, returns `DENY`.
3. **Cumulative Daily Budget**: If `today_spent_paise + amount_paise > daily_spend_limit_paise`, returns `DENY`.
4. **Autonomous Threshold**: If `amount_paise > require_confirmation_above_paise`, returns `REQUIRE_CONFIRMATION`.
5. **Default**: Returns `ALLOW`.

## Example Decision Output
```json
{
  "verdict": "ALLOW",
  "reason": "Transaction of ₹4,999.00 is within autonomous limit of ₹5,000.00 and daily budget.",
  "policy_id": "policy_uuid_123",
  "evaluated_amount_paise": 499900,
  "max_allowed_paise": 500000,
  "confirmation_threshold_paise": 499900
}
```
All verdicts are recorded in both `agent_actions` and `audit_events` tables for instant explainability.
