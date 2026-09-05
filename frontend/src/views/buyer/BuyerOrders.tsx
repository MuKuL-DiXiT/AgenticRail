import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatPaise } from '../../utils/format';

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

interface BuyerOrdersProps {
  orders: Order[];
  onStartShopping: () => void;
}

export const BuyerOrders: React.FC<BuyerOrdersProps> = ({ orders, onStartShopping }) => {
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
            My Orders & Payment Receipts
          </h1>
          <p
            style={{
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Orders negotiated by your autonomous buyer agent and settled via Razorpay Test Rails
          </p>
        </div>

        <button
          onClick={onStartShopping}
          className="btn btn-primary"
          style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
        >
          <ShoppingCart size={15} /> Open AI Shopping Assistant
        </button>
      </div>

      {/* Orders List / Table */}
      <div className="fintech-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="fintech-table">
            <thead>
              <tr>
                <th>Order Reference</th>
                <th>Purchased Items</th>
                <th>Total Paid</th>
                <th>Payment Status</th>
                <th>Merchant</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    {o.id.slice(0, 14)}...
                  </td>

                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                    </div>
                  </td>

                  <td className="font-mono" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {formatPaise(
                      o.total_paise > 0
                        ? o.total_paise
                        : o.items.reduce((sum, i) => sum + (i.subtotal_paise || (i.unit_price_paise * i.quantity) || 0), 0)
                    )}
                  </td>

                  <td>
                    <StatusBadge status={o.status} />
                  </td>

                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      UrbanFit Athletics
                    </span>
                  </td>

                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(o.created_at).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                    <ShoppingCart size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                    <div>No orders placed yet.</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Ask your AI agent to discover and purchase products.
                    </div>
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
