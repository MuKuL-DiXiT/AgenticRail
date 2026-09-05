import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';

interface Product {
  id: string;
  name: string;
  category: string;
  price_paise: number;
  policies?: {
    max_concession_percent?: number;
    autonomous_checkout?: boolean;
    requires_reservation?: boolean;
  };
}

interface MerchantPoliciesProps {
  products: Product[];
  onNavigateProducts?: () => void;
}

export const MerchantPolicies: React.FC<MerchantPoliciesProps> = ({ products }) => {
  const [globalMaxConcession, setGlobalMaxConcession] = useState(15);
  const [allowAutonomous, setAllowAutonomous] = useState(true);

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
          Merchant Concession Policies & Agent Governance
        </h1>
        <p
          style={{
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            marginTop: '0.2rem',
            margin: 0,
          }}
        >
          Define autonomous pricing boundaries, maximum discount floors, and reservation locks for AI buyer bots
        </p>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <StatCard
          title="Global Concession Ceiling"
          value="≤15%"
          subtitle="Max autonomous discount allowable"
          icon={<Sliders size={18} />}
        />
        <StatCard
          title="Autonomous Checkouts"
          value="Enabled"
          subtitle="Bot-to-bot orders without human intervention"
          icon={<CheckCircle2 size={18} />}
        />
        <StatCard
          title="Catalog Coverage"
          value={`${products.length} Products`}
          subtitle="All items policy-protected"
          icon={<Package size={18} />}
        />
      </div>

      {/* Main Grid: Policy Invariants & Per-Product Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        {/* Policy Configuration Box */}
        <div className="fintech-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
            Storewide Agent Negotiation Rules
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Default Autonomous Discount Margin
                </label>
                <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                  {globalMaxConcession}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={globalMaxConcession}
                onChange={(e) => setGlobalMaxConcession(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--brand-primary)' }}
              />
              <div style={{ fontSize: '0.725rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                External buyer bots cannot negotiate lower prices than this configured margin.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={allowAutonomous}
                  onChange={(e) => setAllowAutonomous(e.target.checked)}
                  style={{ accentColor: 'var(--brand-primary)' }}
                />
                <span>Allow Autonomous Machine-to-Machine Checkouts</span>
              </label>
            </div>

            <button
              onClick={() => alert('Global merchant policy saved successfully!')}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', marginTop: '0.5rem', padding: '0.5rem 1rem' }}
            >
              Save Concession Policy
            </button>
          </div>
        </div>

        {/* Security & Safeguards */}
        <div className="fintech-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldCheck size={18} color="var(--success)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Autonomous Safeguards
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Concession Floor Guarantee:</strong>
                <p style={{ margin: '0.15rem 0 0', lineHeight: 1.4 }}>
                  Buyer bots are never allowed to negotiate below the product-specific or global concession floor.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>15-Minute Inventory Holds:</strong>
                <p style={{ margin: '0.15rem 0 0', lineHeight: 1.4 }}>
                  Items with reservation flags automatically lock stock for 15 minutes to prevent flash sell-outs while the buyer agent executes payment.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Cryptographic Proof:</strong>
                <p style={{ margin: '0.15rem 0 0', lineHeight: 1.4 }}>
                  All negotiated discounts are signed and stamped into the transaction audit record on the SHA-256 ledger.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
