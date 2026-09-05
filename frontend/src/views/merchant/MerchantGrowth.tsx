import React, { useState } from 'react';
import {
  TrendingUp,
  Layers,
  Sliders,
} from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';

interface MerchantGrowthProps {
  productsCount?: number;
  totalOrders?: number;
  onNavigateTab?: (tabId: string) => void;
}

export const MerchantGrowth: React.FC<MerchantGrowthProps> = () => {
  const [appliedRules, setAppliedRules] = useState<Record<string, boolean>>({
    'rule-1': true,
    'rule-2': false,
  });

  const toggleRule = (ruleId: string) => {
    setAppliedRules((prev) => ({ ...prev, [ruleId]: !prev[ruleId] }));
  };

  const opportunities = [
    {
      id: 'rule-1',
      triggerProduct: 'Nike Alphafly 3 Proto / Running Shoes',
      recommendedProduct: 'Merino Anti-Blister Technical Socks',
      recommendation: 'Autonomous bundle discount of 10% when buying marathon shoes.',
      uplift: '+12.4%',
      confidence: 'High (84% buyer match)',
      reasoning: 'Buyer agents purchasing high-end running shoes have a 3.4x higher conversion rate when complementary hydration or blister-prevention items are offered before autonomous checkout.',
    },
    {
      id: 'rule-2',
      triggerProduct: 'Hydration Running Vest 12L',
      recommendedProduct: '500ml Collapsible Soft Flask',
      recommendation: 'Cross-sell hydration flasks directly during agent cart negotiation.',
      uplift: '+8.7%',
      confidence: 'Medium (68% buyer match)',
      reasoning: 'Vests purchased without included flasks trigger subsequent buyer search queries 72% of the time. Pre-negotiating the flask in the initial session captures additional basket revenue.',
    },
  ];

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
          AI Growth Engine & Cross-Sell Rules
        </h1>
        <p
          style={{
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            marginTop: '0.2rem',
            margin: 0,
          }}
        >
          Autonomous recommendation triggers that expand basket size during buyer agent sessions
        </p>
      </div>

      {/* KPI Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <StatCard
          title="Avg Basket Expansion"
          value="+10.5%"
          subtitle="Observed during autonomous sessions"
          icon={<TrendingUp size={18} />}
          badge="AI Metric"
        />
        <StatCard
          title="Active Recommendation Rules"
          value="2 Rules"
          subtitle="Monitored by merchant growth worker"
          icon={<Layers size={18} />}
        />
        <StatCard
          title="Autonomous Policy Floor"
          value="≤15% Max"
          subtitle="Enforced by deterministic policy engine"
          icon={<Sliders size={18} />}
        />
      </div>

      {/* Opportunities List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Active Growth Opportunities
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Real-time inference based on catalog affinity
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {opportunities.map((opp) => {
            const isApplied = appliedRules[opp.id];

            return (
              <div
                key={opp.id}
                className="fintech-card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: isApplied ? '3px solid var(--brand-primary)' : '1px solid var(--surface-border)',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}
                      >
                        Target Trigger
                      </span>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {opp.triggerProduct}
                      </div>
                    </div>
                    <span className="badge badge-success">{opp.uplift} Uplift</span>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '0.2rem' }}>
                      Recommended Cross-Sell:
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {opp.recommendedProduct}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0', lineHeight: 1.4 }}>
                      {opp.recommendation}
                    </p>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1rem' }}>
                    <strong>Strategic Rationale:</strong> {opp.reasoning}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--surface-border)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Confidence: <strong>{opp.confidence}</strong>
                  </span>
                  <button
                    onClick={() => toggleRule(opp.id)}
                    className={isApplied ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    {isApplied ? '✓ Rule Active' : 'Activate Rule'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
