import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  DollarSign,
  Sliders,
} from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { formatPaise } from '../../utils/format';

interface Policy {
  id: string;
  buyer_id: string;
  max_transaction_paise: number;
  daily_spend_limit_paise: number;
  require_confirmation_above_paise: number;
  allowed_categories: string[];
}

interface BuyerPoliciesProps {
  policy: Policy | null;
  todaySpent: number;
  onUpdatePolicy: (updated: Policy) => Promise<void>;
}

export const BuyerPolicies: React.FC<BuyerPoliciesProps> = ({
  policy,
  todaySpent,
  onUpdatePolicy,
}) => {
  const [localPolicy, setLocalPolicy] = useState<Policy | null>(policy);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync if policy loads later
  React.useEffect(() => {
    if (policy) {
      setLocalPolicy(policy);
    }
  }, [policy]);

  const handleSave = async () => {
    if (!localPolicy) return;
    setIsSaving(true);
    try {
      await onUpdatePolicy(localPolicy);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const dailyLimit = localPolicy?.daily_spend_limit_paise || 1000000;
  const budgetUtilization = dailyLimit > 0 ? Math.min(100, Math.round((todaySpent / dailyLimit) * 100)) : 0;

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
          Autonomous Spending Limits & Guardrails
        </h1>
        <p
          style={{
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            marginTop: '0.2rem',
            margin: 0,
          }}
        >
          Deterministic policy boundaries controlling autonomous buyer agent spend permissions
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
          title="Single Transaction Ceiling"
          value={formatPaise(localPolicy?.max_transaction_paise || 500000)}
          subtitle="Max allowable amount per autonomous order"
          icon={<DollarSign size={18} />}
        />

        <StatCard
          title="Daily Spend Budget"
          value={formatPaise(dailyLimit)}
          subtitle={`${formatPaise(todaySpent)} settled today (${budgetUtilization}%)`}
          icon={<Sliders size={18} />}
        />

        <StatCard
          title="Confirmation Threshold"
          value={formatPaise(localPolicy?.require_confirmation_above_paise || 499900)}
          subtitle="Orders above this trigger explicit human approval"
          icon={<ShieldCheck size={18} />}
        />
      </div>

      {/* Main Grid: Policy Form & Security Guarantees */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        {/* Form Card */}
        <div className="fintech-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>
            Configure Spending Rules
          </h2>

          {localPolicy && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  Max Single Transaction Limit (₹ INR) — {formatPaise(localPolicy.max_transaction_paise)}
                </label>
                <input
                  type="number"
                  value={localPolicy.max_transaction_paise / 100}
                  onChange={(e) =>
                    setLocalPolicy({
                      ...localPolicy,
                      max_transaction_paise: Number(e.target.value) * 100,
                    })
                  }
                  className="fintech-input font-mono"
                  style={{ height: '38px' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Purchases exceeding this amount are immediately blocked by the policy engine.
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  Daily Spending Budget (₹ INR) — {formatPaise(localPolicy.daily_spend_limit_paise)}
                </label>
                <input
                  type="number"
                  value={localPolicy.daily_spend_limit_paise / 100}
                  onChange={(e) =>
                    setLocalPolicy({
                      ...localPolicy,
                      daily_spend_limit_paise: Number(e.target.value) * 100,
                    })
                  }
                  className="fintech-input font-mono"
                  style={{ height: '38px' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Resets daily at 00:00 UTC. Prevents runaway agent purchases.
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  Human Confirmation Threshold (₹ INR) — {formatPaise(localPolicy.require_confirmation_above_paise)}
                </label>
                <input
                  type="number"
                  value={localPolicy.require_confirmation_above_paise / 100}
                  onChange={(e) =>
                    setLocalPolicy({
                      ...localPolicy,
                      require_confirmation_above_paise: Number(e.target.value) * 100,
                    })
                  }
                  className="fintech-input font-mono"
                  style={{ height: '38px' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Transactions between this threshold and max limit require 1-click confirmation before payment.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn btn-primary"
                  style={{ minWidth: '160px', padding: '0.55rem 1rem' }}
                >
                  {isSaving ? 'Updating...' : 'Save Policy Changes'}
                </button>

                {savedSuccess && (
                  <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle2 size={15} /> Saved successfully!
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Security Invariants Card */}
        <div className="fintech-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Lock size={18} color="var(--brand-primary)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Deterministic Security Guarantees
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.825rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>No LLM Money Movement:</strong>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Language models only parse natural language and recommend items. The deterministic TypeScript engine computes totals and evaluates policies.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Integer-Safe Mathematical Units:</strong>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  All prices, discounts, and budgets are tracked strictly in integer paise to eliminate IEEE-754 floating point arithmetic flaws.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Cryptographic Settlement:</strong>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Every transaction links to parent blocks via SHA-256 hashes, creating an irreversible, tamper-evident audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
