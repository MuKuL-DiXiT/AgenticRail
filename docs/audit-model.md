# Cryptographic Audit Model

AgentCart maintains two levels of observability:
1. **Human-Readable Audit Events (`audit_events`)**: Chronological event logs for timeline visualization.
2. **Tamper-Evident SHA-256 Ledger (`ledger`)**: Cryptographically chained blocks guaranteeing financial immutability.

## Event Schema
```typescript
interface AuditEvent {
  id: string; // UUIDv4
  timestamp: string; // ISO UTC
  conversation_id: string;
  actor: 'BUYER_AGENT' | 'MERCHANT_AGENT' | 'POLICY_ENGINE' | 'ORDER_SERVICE' | 'RAZORPAY' | 'WEBHOOK' | 'LEDGER';
  event_type: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  status: 'SUCCESS' | 'WARNING' | 'FAILURE' | 'INFO';
}
```

## Hash-Chaining Formula
For block $i$:
$$\text{Hash}_i = \text{SHA256}(\text{JSON}(\text{Payload}_i, \text{prev\_hash} = \text{Hash}_{i-1}, \text{timestamp}_i))$$
For genesis block ($i=0$), $\text{prev\_hash} = 0^{64}$.
