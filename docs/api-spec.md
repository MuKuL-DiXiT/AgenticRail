# AgentCart REST API Specification

This document details the complete REST API interface provided by the AgentCart Backend service (`http://localhost:3000` or port configured via `.env`).

---

## Authentication & Headers

- **JWT Authentication**: Secured endpoints require header `Authorization: Bearer <jwt_token>`.
- **Content-Type**: `application/json` for POST/PUT endpoints.

---

## Endpoints Overview

### 1. Merchant Manifest & Capabilities

#### `GET /api/merchants/:merchant_id/agent-manifest`
Exposes the machine-readable manifest for autonomous AI Buyer Agents.

- **URL Params**: `merchant_id` (e.g., `mch_urbanfit_001`)
- **Response `200 OK`**:
```json
{
  "manifest_version": "1.0.0",
  "merchant": {
    "id": "mch_urbanfit_001",
    "name": "UrbanFit Athletics",
    "category": "Sports & Fitness"
  },
  "capabilities": {
    "catalog_search": {
      "endpoint": "/api/merchants/mch_urbanfit_001/catalog/search",
      "method": "GET"
    },
    "negotiation": {
      "endpoint": "/api/merchants/mch_urbanfit_001/negotiate",
      "method": "POST"
    },
    "cart_management": {
      "create_cart": "/api/carts",
      "add_item": "/api/carts/:cart_id/items"
    },
    "checkout": {
      "create_order": "/api/orders",
      "request_payment": "/api/payments/request"
    }
  }
}
```

---

### 2. Catalog & Discovery

#### `GET /api/products`
Retrieves all active catalog products.

#### `GET /api/products/search?q=:query&max_price=:max_price`
Searches product catalog using token matching, category synonyms, and price thresholds. Note: Merchant margin limits are redacted from public responses.

---

### 3. Agent Negotiation Protocol

#### `POST /api/merchants/:merchant_id/negotiate`
Submits a dynamic concession bid to the Merchant Agent.

- **Request Body**:
```json
{
  "product_id": "prod_pegasus_40",
  "requested_discount_percent": 15
}
```

- **Response `200 OK`**:
```json
{
  "accepted": true,
  "discount_percentage": 10,
  "discount_paise": 49990,
  "counter_offer": false,
  "rationale": "Automated price match within merchant concession policy floor."
}
```

---

### 4. Policy Engine

#### `GET /api/policy/:buyer_id`
Retrieves configured spending rules for a buyer.

#### `POST /api/policy/evaluate`
Evaluates a transaction amount against policy limits.

- **Request Body**:
```json
{
  "buyer_id": "rahul@runner.ai",
  "amount_paise": 499900,
  "categories": ["footwear"]
}
```

- **Response `200 OK`**:
```json
{
  "verdict": "ALLOW",
  "reason": "Amount within single transaction limit and daily spend cap.",
  "max_allowed_paise": 500000,
  "ticket": "ticket_signed_token_hash"
}
```

---

### 5. Cart & Order Operations

#### `POST /api/carts`
Creates a shopping cart session.

#### `POST /api/carts/:cart_id/items`
Adds an item to an active cart.

#### `POST /api/orders`
Converts an active cart into a confirmed pending order using a signed single-use policy ticket.

---

### 6. Payment & Webhooks

#### `POST /api/payments/request`
Initiates payment processing with Razorpay Test Mode.

#### `POST /api/webhooks/razorpay`
Idempotent webhook listener for Razorpay payment capture notifications. Verifies HMAC-SHA256 signature against `RAZORPAY_WEBHOOK_SECRET`.

---

### 7. Ledger & Audit Certificates

#### `GET /api/ledger`
Retrieves full cryptographic ledger hash chain.

#### `GET /api/ledger/verify`
Executes full hash-chain verification and returns boolean validity with tamper localization if corrupted.

#### `GET /api/ledger/certificate`
Generates an exportable cryptographic audit certificate with cumulative ledger hash fingerprints.
