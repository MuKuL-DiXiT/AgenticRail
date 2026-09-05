import React, { useState } from 'react';
import {
  Copy,
  ExternalLink,
  Terminal,
} from 'lucide-react';

interface MerchantManifestProps {
  manifest: any;
  apiBase: string;
}

export const MerchantManifest: React.FC<MerchantManifestProps> = ({ manifest, apiBase }) => {
  const [copied, setCopied] = useState(false);

  const copyManifest = () => {
    if (manifest) {
      navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const manifestUrl = `${apiBase}/api/merchants/mch_urbanfit_001/agent-manifest`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Agent Commerce Interface (Manifest)
          </h1>
          <p
            style={{
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Public machine-readable ACP contract exposed to autonomous buyer agents and LLM tools
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={copyManifest}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
          >
            <Copy size={14} /> {copied ? 'Copied to Clipboard!' : 'Copy JSON'}
          </button>
          <a
            href={manifestUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
          >
            <ExternalLink size={14} /> View Raw Endpoint
          </a>
        </div>
      </div>

      {/* Protocol Specs Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="fintech-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Manifest Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--success)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Active</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Live indexing enabled
          </div>
        </div>

        <div className="fintech-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Protocol Version
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }} className="font-mono">
            agentcart.v1
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Agentic Commerce Protocol
          </div>
        </div>

        <div className="fintech-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Active Capabilities
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)', marginTop: '0.35rem' }} className="font-mono">
            5 Registered
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Catalog, Cart, Checkout, Order, Locks
          </div>
        </div>

        <div className="fintech-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Payment Engine
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            Razorpay Test Rails
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.2rem', fontWeight: 500 }}>
            Webhook Verified [OK]
          </div>
        </div>
      </div>

      {/* Main Grid: Capabilities Documentation & Raw JSON */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem' }}>
        {/* Capabilities Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="fintech-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.85rem' }}>
              Standard Protocol Capabilities
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                {
                  cap: 'catalog.search',
                  method: 'GET',
                  path: '/api/catalog/products',
                  desc: 'Semantic and token-based catalog search with price and tag filters.',
                },
                {
                  cap: 'cart.create',
                  method: 'POST',
                  path: '/api/cart',
                  desc: 'Deterministic multi-item cart generation with price lock verification.',
                },
                {
                  cap: 'checkout.create',
                  method: 'POST',
                  path: '/api/checkout/create-order',
                  desc: 'Razorpay test mode order creation with cryptographic webhook payload verification.',
                },
                {
                  cap: 'order.status',
                  method: 'GET',
                  path: '/api/orders/:id',
                  desc: 'Live query of payment settlement state on the SHA-256 ledger.',
                },
                {
                  cap: 'inventory.reserve',
                  method: 'POST',
                  path: '/api/inventory/reserve',
                  desc: '15-minute lock on scarce variants during buyer negotiation.',
                },
              ].map((c) => (
                <div
                  key={c.cap}
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    padding: '0.75rem 0.9rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {c.cap}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        background: c.method === 'GET' ? 'var(--info-light)' : 'var(--brand-primary-light)',
                        color: c.method === 'GET' ? 'var(--info)' : 'var(--brand-primary)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                      }}
                    >
                      {c.method}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                    {c.path}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {c.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Formatted JSON Inspector */}
        <div className="fintech-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <Terminal size={16} color="var(--brand-primary)" /> Live Manifest JSON Output
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              Content-Type: application/json
            </span>
          </div>

          <pre
            className="font-mono"
            style={{
              background: '#f6f8fa',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              padding: '1rem',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              overflowX: 'auto',
              maxHeight: '520px',
              margin: 0,
              flex: 1,
            }}
          >
            {manifest ? JSON.stringify(manifest, null, 2) : '// Loading manifest from backend...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
