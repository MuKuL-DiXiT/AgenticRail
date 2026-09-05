import React from 'react';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  ShoppingCart,
  DollarSign,
  Package,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface MerchantOverviewProps {
  merchantStats: {
    total_orders: number;
    total_revenue_paise: number;
    total_products: number;
    low_stock_items: number;
    recent_orders: any[];
  } | null;
  analytics: any | null;
  productsCount: number;
  orders: any[];
  onNavigateTab: (tabId: string) => void;
}

export const MerchantOverview: React.FC<MerchantOverviewProps> = ({
  merchantStats,
  analytics,
  productsCount,
  orders,
  onNavigateTab,
}) => {
  const settledRevenuePaise = merchantStats
    ? merchantStats.total_revenue_paise
    : analytics?.totalRevenuePaise || 0;
  const totalOrders = merchantStats
    ? merchantStats.total_orders
    : orders.length || analytics?.totalOrders || 0;
  const activeProducts = merchantStats
    ? merchantStats.total_products
    : productsCount || 0;
  const lowStock = merchantStats ? merchantStats.low_stock_items : 0;

  const recentOrdersList = orders.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Welcome & Time Range Header */}
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
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Good morning, UrbanFit Athletics
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginTop: '0.25rem',
              margin: 0,
            }}
          >
            Real-time agentic commerce operations & Razorpay payment settlement
          </p>
        </div>

        {/* Date Filter Badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#ffffff',
            border: '1px solid var(--surface-border)',
            borderRadius: '6px',
            padding: '2px',
          }}
        >
          {['Today', '7D', '30D', 'All Time'].map((range, idx) => (
            <button
              key={range}
              style={{
                background: idx === 3 ? 'var(--bg-canvas)' : 'transparent',
                border: 'none',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: idx === 3 ? 600 : 500,
                color: idx === 3 ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        <StatCard
          title="Settled Revenue (DB)"
          value={`₹${(settledRevenuePaise / 100).toLocaleString('en-IN')}`}
          subtitle="Direct Razorpay Test Rails settlement"
          icon={<DollarSign size={18} />}
          badge="Live"
        />

        <StatCard
          title="Total Orders"
          value={totalOrders}
          subtitle="Processed via AI agentic protocol"
          icon={<ShoppingCart size={18} />}
        />

        <StatCard
          title="Active Catalog Products"
          value={activeProducts}
          subtitle="Published to machine-readable manifest"
          icon={<Package size={18} />}
        />

        <StatCard
          title="Low Stock Alert"
          value={lowStock}
          subtitle={lowStock > 0 ? 'Restock recommended (<10 units)' : 'Inventory healthy across all SKUs'}
          icon={<AlertTriangle size={18} />}
          isAlert={lowStock > 0}
        />
      </div>

      {/* Main Grid: Recent Transactions & AI Growth Engine Highlights */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: '1.5rem',
        }}
      >
        {/* Left Column: Recent Transactions Table */}
        <div className="fintech-card" style={{ padding: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Recent Transactions
              </h2>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  marginTop: '0.15rem',
                  margin: 0,
                }}
              >
                Live payments settled to SQLite ledger
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              View All Orders <ArrowRight size={13} />
            </button>
          </div>

          {recentOrdersList.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="fintech-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrdersList.map((order) => (
                    <tr key={order.id}>
                      <td className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {order.id.slice(0, 10)}...
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{order.buyer_id || 'Autonomous Buyer'}</span>
                      </td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>
                        ₹{((order.total_paise || 0) / 100).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                color: 'var(--text-tertiary)',
                fontSize: '0.875rem',
              }}
            >
              <ShoppingCart size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <div>No transactions recorded yet</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Initiate a buyer agent checkout to see live settlement here.
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Growth & Protocol Highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* AI Opportunity Card */}
          <div className="fintech-card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--brand-primary)',
                }}
              >
                AI Growth Opportunity
              </span>
              <span className="badge badge-success">+12.4% Est. Lift</span>
            </div>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Dynamic Bundle: Running Shoes + Merino Socks
            </h3>
            <p
              style={{
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: '0 0 1rem',
              }}
            >
              Buyer agents searching for marathon footwear have an 84% cross-sell affinity with anti-blister technical socks when offered a 10% bundle concession.
            </p>

            <button
              onClick={() => onNavigateTab('growth')}
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}
            >
              Review Growth Rules <ArrowRight size={14} />
            </button>
          </div>

          {/* Infrastructure Security Card */}
          <div className="fintech-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <ShieldCheck size={18} color="var(--brand-primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                Fintech Rails & Security
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Rail:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--success)' }}>
                  Razorpay Test Rails Active ✓
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Settlement Ledger:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  SHA-256 Hash Chain
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Policy Engine:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                  Deterministic (Non-LLM)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Explainer Card */}
      <div
        className="fintech-card"
        style={{
          padding: '1.25rem 1.5rem',
          background: '#ffffff',
          border: '1px solid var(--surface-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Zap size={18} color="var(--brand-primary)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
            How AgentCart Operates — End-to-End Autonomous Commerce Rails
          </h3>
        </div>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            marginBottom: '1rem',
          }}
        >
          Merchants publish machine-readable capability manifests. External buyer agents discover items semantically, evaluate deterministic spending policies, and execute signed Razorpay payments settling onto an immutable SHA-256 ledger.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {[
            { step: '1. Manifest Discovery', desc: 'Catalog & endpoints published in agentcart.v1 format.' },
            { step: '2. Growth Engine', desc: 'Personalized cross-sell & concession suggestions.' },
            { step: '3. Policy Gating', desc: 'Deterministic spending limit enforcement (ALLOW/DENY).' },
            { step: '4. Razorpay Test Rails', desc: 'Order creation & cryptographic signature verification.' },
            { step: '5. Immutable Ledger', desc: 'SHA-256 hash-chain transaction settlement.' },
          ].map((s, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-canvas)',
                padding: '0.75rem 0.9rem',
                borderRadius: '6px',
                border: '1px solid var(--surface-border)',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--brand-primary)',
                  fontSize: '0.8rem',
                  marginBottom: '0.25rem',
                }}
              >
                {s.step}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
