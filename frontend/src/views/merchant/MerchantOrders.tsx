import React, { useState } from 'react';
import {
  Search,
  ShoppingCart,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface OrderItem {
  product_id: string;
  variant_id?: string;
  product_name: string;
  unit_price_paise: number;
  quantity: number;
  subtotal_paise: number;
}

interface Order {
  id: string;
  buyer_id: string;
  merchant_id: string;
  status: string;
  items: OrderItem[];
  total_paise: number;
  currency: string;
  created_at: string;
}

interface MerchantOrdersProps {
  orders: Order[];
  onRefreshOrders?: () => void;
}

export const MerchantOrders: React.FC<MerchantOrdersProps> = ({ orders, onRefreshOrders }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.buyer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((it) => it.product_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || o.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleExpand = (id: string) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
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
          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Orders & Payment Transactions
          </h1>
          <p
            style={{
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Real-time payments settled via Razorpay Test Rails onto the SHA-256 ledger
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              background: '#ffffff',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--surface-border)',
            }}
          >
            {orders.length} Total Records
          </span>
          {onRefreshOrders && (
            <button
              onClick={onRefreshOrders}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="fintech-card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '340px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '10px',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            placeholder="Search by Order ID, buyer, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="fintech-input"
            style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Status Filter Badges */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {['ALL', 'PAID', 'PENDING', 'PAYMENT_FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                border: '1px solid',
                borderColor: statusFilter === st ? 'var(--brand-primary)' : 'var(--surface-border)',
                background: statusFilter === st ? 'var(--brand-primary-light)' : '#ffffff',
                color: statusFilter === st ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {st === 'ALL' ? 'All Transactions' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="fintech-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="fintech-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}></th>
                <th>Order ID</th>
                <th>Buyer / Customer</th>
                <th>Items Purchased</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Payment Rail</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;

                return (
                  <React.Fragment key={order.id}>
                    <tr
                      onClick={() => toggleExpand(order.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        {isExpanded ? (
                          <ChevronDown size={15} color="var(--text-secondary)" />
                        ) : (
                          <ChevronRight size={15} color="var(--text-tertiary)" />
                        )}
                      </td>

                      <td className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                        {order.id.slice(0, 14)}...
                      </td>

                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{order.buyer_id}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Autonomous AI Buyer</div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {order.items.map((i) => i.product_name).join(', ').slice(0, 32)}
                          {order.items.map((i) => i.product_name).join(', ').length > 32 ? '...' : ''}
                        </div>
                      </td>

                      <td className="font-mono" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        ₹{((order.total_paise || 0) / 100).toLocaleString('en-IN')}
                      </td>

                      <td>
                        <StatusBadge status={order.status} />
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-canvas)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid var(--surface-border)',
                          }}
                        >
                          Razorpay Test
                        </span>
                      </td>

                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>

                    {/* Expandable Order Detail Drawer */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: '1rem 1.5rem', background: 'var(--bg-canvas)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                            {/* Line Items Detail */}
                            <div
                              style={{
                                background: '#ffffff',
                                border: '1px solid var(--surface-border)',
                                borderRadius: '8px',
                                padding: '1rem',
                              }}
                            >
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                Itemized Breakdown
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {order.items.map((it, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.825rem',
                                      padding: '0.4rem 0',
                                      borderBottom: '1px solid var(--surface-border)',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 500 }}>{it.product_name}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        Qty: {it.quantity} × ₹{((it.unit_price_paise || 0) / 100).toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                    <div className="font-mono" style={{ fontWeight: 600 }}>
                                      ₹{((it.subtotal_paise || 0) / 100).toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                ))}

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: '0.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  <span>Total Settled:</span>
                                  <span className="font-mono" style={{ color: 'var(--brand-primary)' }}>
                                    ₹{((order.total_paise || 0) / 100).toLocaleString('en-IN')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Settlement & Audit Proof */}
                            <div
                              style={{
                                background: '#ffffff',
                                border: '1px solid var(--surface-border)',
                                borderRadius: '8px',
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem',
                                fontSize: '0.8rem',
                              }}
                            >
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Fintech Audit & Rails
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Full Order ID:</span>
                                <span className="font-mono" style={{ fontWeight: 600, fontSize: '0.75rem' }}>{order.id}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Merchant ID:</span>
                                <span className="font-mono" style={{ fontSize: '0.75rem' }}>{order.merchant_id}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Ledger Verification:</span>
                                <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <CheckCircle2 size={13} /> Linked to SHA-256 Chain
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Payment Method:</span>
                                <span style={{ fontWeight: 500 }}>Razorpay Test Rails (UPI/Card)</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                    <ShoppingCart size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                    <div>No orders found matching your search.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
