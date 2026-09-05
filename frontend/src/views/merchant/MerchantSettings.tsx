import React from 'react';
import {
  CreditCard,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface MerchantSettingsProps {
  simulateFailure: boolean;
  onToggleFailure: () => void;
  apiBase: string;
}

export const MerchantSettings: React.FC<MerchantSettingsProps> = ({
  simulateFailure,
  onToggleFailure,
  apiBase,
}) => {
  const manifestUrl = `${apiBase}/api/merchants/mch_urbanfit_001/agent-manifest`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
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
          Diagnostics & Razorpay Test Rails
        </h1>
        <p
          style={{
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            marginTop: '0.2rem',
            margin: 0,
          }}
        >
          Environment configuration, payment failure simulations, and developer API contracts
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Payment Rails Card */}
        <div className="fintech-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CreditCard size={18} color="var(--brand-primary)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Payment Provider Rails
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--surface-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Razorpay Test Mode</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Platform shared sandbox for UPI, cards, and netbanking test webhooks
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                Connected
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--surface-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Webhook Signature Verification</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  HMAC-SHA256 signature enforcement on incoming Razorpay events
                </div>
              </div>
              <span className="badge badge-success">Enforced</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Idempotency Guard</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Duplicate webhook payloads are acknowledged without double-settlement
                </div>
              </div>
              <span className="badge badge-success">Active</span>
            </div>
          </div>
        </div>

        {/* Failure Simulation Card */}
        <div className="fintech-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <AlertTriangle size={18} color={simulateFailure ? 'var(--error)' : 'var(--warning)'} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Chaos Engineering & Failure Simulation
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ maxWidth: '600px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Simulate Payment Failure Mode
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                When enabled, next checkout transactions will intentionally fail during payment capture. Demonstrates that no ledger funds are credited, order status transitions safely to PAYMENT_FAILED, and user is cleanly notified.
              </div>
            </div>

            <button
              onClick={onToggleFailure}
              className={`btn ${simulateFailure ? 'btn-danger' : 'btn-secondary'}`}
              style={{ minWidth: '160px' }}
            >
              {simulateFailure ? 'Failure Mode Active [ON]' : 'Enable Failure Mode'}
            </button>
          </div>
        </div>

        {/* API Contract & Manifest */}
        <div className="fintech-card" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Machine-Readable ACP Agent Manifest
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Public JSON schema for AI buyer agent discovery and capability introspection
              </div>
            </div>

            <a
              href={manifestUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem' }}
            >
              <ExternalLink size={14} /> Open Live Manifest
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
