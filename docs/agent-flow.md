# Agent Workflow & State Machine

The **AgentCart Buyer Agent** orchestrates an autonomous shopping session through an explicit state machine.

```mermaid
stateDiagram-v2
    [*] --> START
    START --> UNDERSTAND_INTENT
    UNDERSTAND_INTENT --> SEARCH_CATALOG : Parse query & budget
    SEARCH_CATALOG --> EVALUATE_PRODUCTS : Re-rank by category & score
    EVALUATE_PRODUCTS --> RECOMMEND : Formulate explainable recommendation
    RECOMMEND --> BUILD_CART : User affirms / selects item
    BUILD_CART --> UPSELL_PROPOSAL : Growth Engine suggests add-on
    UPSELL_PROPOSAL --> BUILD_CART : User accepts add-on
    UPSELL_PROPOSAL --> CALCULATE_TOTAL : User declines add-on
    BUILD_CART --> CALCULATE_TOTAL : Cart prepared
    CALCULATE_TOTAL --> CHECK_POLICY : Evaluate spending constraints
    CHECK_POLICY --> REQUEST_CONFIRMATION : If amount > threshold
    CHECK_POLICY --> CREATE_ORDER : If ALLOW
    CHECK_POLICY --> COMPLETE : If DENY
    REQUEST_CONFIRMATION --> CREATE_ORDER : User confirms
    CREATE_ORDER --> REQUEST_PAYMENT : Initialize Razorpay Test Mode
    REQUEST_PAYMENT --> PAYMENT_PENDING
    PAYMENT_PENDING --> PAYMENT_CONFIRMED : Webhook / Signature verified
    PAYMENT_PENDING --> PAYMENT_FAILED : Bank declined / Test simulation
    PAYMENT_CONFIRMED --> COMPLETE : Ledger entry appended
    PAYMENT_FAILED --> COMPLETE : Safe retry offered
```

## Agent Tools & Guardrails
All tools enforce strict Zod schemas and contain zero direct database mutation or payment execution powers:
- `search_products`: Semantic query over catalog.
- `get_product`: Fetches variants and attributes.
- `check_inventory`: Verifies stock availability.
- `get_product_recommendations`: Retrieves deterministic upsell candidates.
- `create_cart` & `add_to_cart`: Manages cart lifecycle.
- `check_policy`: Invokes deterministic Policy Engine.
- `create_order`: Formalizes order.
- `request_payment`: Interfaces with Razorpay payment service.
