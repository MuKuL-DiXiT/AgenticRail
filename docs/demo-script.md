# Hackathon Demo Script — AgentCart

This script demonstrates the complete capabilities of **AgentCart** for Hackathon Judges.

---

## 3-Minute Live Demo Walkthrough

### 1. Show the Machine-Readable Merchant
- Navigate to the **"Merchant Catalog & Manifest"** tab.
- Show the **UrbanFit Athletics** catalog (Nike Pegasus ₹4,999, Running Socks ₹499, Hydration Vest ₹1,299).
- Click **"Copy JSON"** on the Agent Manifest inspector:
  > *"Here is the merchant's machine-readable manifest (`GET /api/merchants/:id/agent-manifest`) describing supported capabilities, protocols, and autonomous checkout endpoints."*

---

### 2. Autonomous Conversational Shopping Flow
- Switch to the **"AI Buyer & Chat"** tab.
- Click the suggested pill or type:
  ```text
  I need running shoes for under ₹5,000
  ```
- **Observe:**
  1. The agent discovers 3 products from the merchant catalog.
  2. The agent explains its top recommendation: **Nike Air Zoom Pegasus 40** (₹4,999).
- Click **"Yes, add to cart"**.
- **Observe (Growth Engine):**
  > The agent offers a contextual upsell: *"Pair with Nike Dri-FIT Cushioned Running Socks (3-Pack) for ₹499"*.
- Click **"No, proceed to checkout"**.
- **Observe (Policy Gating):**
  > The Policy Engine deterministically evaluates the ₹4,999 cart against the ₹5,000 autonomous limit and outputs: **✅ Policy Status: ALLOWED**.
- Click **"Yes, proceed with payment"**.
- **Observe (Razorpay & Settlement):**
  > Payment executes, signature is verified, and the transaction settles onto the SHA-256 cryptographic ledger!

---

### 3. Verify Cryptographic Ledger & Tamper Detection
- Navigate to **"Audit Trail & Hash Ledger"** tab.
- Click **"Verify Ledger"** -> Notice it flashes **Green (Valid Chain)**.
- Click the red **"Tamper (Demo)"** button in the header -> Simulates a malicious SQL update altering a transaction hash.
- Click **"Verify Ledger"** again -> It immediately flashes **Red (Tamper Detected)** and localizes the exact block corrupted!

---

### 4. Demonstrate Graceful Failure Recovery
- Click the **"Failure Simulation: ON"** button in the header.
- Execute a purchase in the chat.
- **Observe:**
  > Transaction fails gracefully, status transitions to `PAYMENT_FAILED`, no duplicate charge is created, and safe recovery options are provided!
