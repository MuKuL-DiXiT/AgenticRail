import React, { useRef, useEffect } from 'react';
import {
  Send,
  ShoppingCart,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Bot,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface CartItem {
  product_id: string;
  variant_id?: string;
  product_name: string;
  unit_price_paise: number;
  quantity: number;
  subtotal_paise: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal_paise: number;
  total_paise: number;
}

interface Policy {
  id: string;
  buyer_id: string;
  max_transaction_paise: number;
  daily_spend_limit_paise: number;
  require_confirmation_above_paise: number;
  allowed_categories: string[];
}

interface Message {
  sender: 'user' | 'agent' | 'system';
  text: string;
  action_type?: string;
  policy_verdict?: string;
  timestamp: string;
}

interface BuyerShoppingProps {
  messages: Message[];
  inputText: string;
  onInputChange: (val: string) => void;
  onSendMessage: (customText?: string) => void;
  isProcessing: boolean;
  quickReplies: string[];
  conversationId: string;
  activeCart: Cart | null;
  policy: Policy | null;
  todaySpent: number;
  onClearChat: () => void;
}

export const BuyerShopping: React.FC<BuyerShoppingProps> = ({
  messages,
  inputText,
  onInputChange,
  onSendMessage,
  isProcessing,
  quickReplies,
  conversationId,
  activeCart,
  policy,
  todaySpent,
  onClearChat,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const maxTx = policy ? policy.max_transaction_paise : 500000;
  const dailyLimit = policy ? policy.daily_spend_limit_paise : 1000000;
  const budgetUtilization = dailyLimit > 0 ? Math.min(100, Math.round((todaySpent / dailyLimit) * 100)) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: '1.5rem',
        height: 'calc(100vh - 120px)',
        minHeight: '620px',
      }}
    >
      {/* Left Main Chat Interface */}
      <div
        className="fintech-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '1.25rem',
          overflow: 'hidden',
        }}
      >
        {/* Chat Session Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--surface-border)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--brand-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={18} color="var(--brand-primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Autonomous AI Shopping Assistant
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Session: <span className="font-mono">{conversationId}</span> • UrbanFit Athletics Catalog
              </div>
            </div>
          </div>

          <button
            onClick={onClearChat}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
          >
            <RefreshCw size={12} /> Clear Session
          </button>
        </div>

        {/* Message Feed */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
          }}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: msg.sender === 'user' ? '75%' : '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              {/* Meta Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-tertiary)',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <span>{msg.sender === 'user' ? 'You' : 'AgentCart Commerce Agent'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
                {msg.policy_verdict && (
                  <StatusBadge status={msg.policy_verdict} />
                )}
              </div>

              {/* Bubble Body */}
              <div
                style={{
                  background: msg.sender === 'user' ? 'var(--brand-primary)' : '#ffffff',
                  color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                  border: msg.sender === 'user' ? 'none' : '1px solid var(--surface-border)',
                  borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '0.85rem 1.1rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-line',
                  boxShadow: msg.sender === 'user' ? 'var(--shadow-sm)' : '0 1px 2px rgba(16, 24, 40, 0.04)',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Processing Stepper */}
          {isProcessing && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--surface-border)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.8rem',
                color: 'var(--brand-primary)',
              }}
            >
              <RefreshCw size={14} className="pulse-circle" />
              <span>Evaluating catalog, inventory, and deterministic spending policies...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        {quickReplies.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              flexWrap: 'wrap',
              marginTop: '0.75rem',
              marginBottom: '0.75rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--surface-border)',
            }}
          >
            {quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => onSendMessage(qr)}
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--surface-border)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.color = 'var(--brand-primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--surface-border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        {/* Input Box */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSendMessage()}
            placeholder="Type your purchase request (e.g. Find me marathon running shoes under ₹5,000)..."
            className="fintech-input"
            style={{ flex: 1, height: '42px', fontSize: '0.875rem' }}
          />
          <button
            onClick={() => onSendMessage()}
            disabled={isProcessing || !inputText.trim()}
            className="btn btn-primary"
            style={{ padding: '0 1.25rem', height: '42px', fontSize: '0.85rem' }}
          >
            <Send size={15} /> Send
          </button>
        </div>
      </div>

      {/* Right Column: Live Cart & Autonomous Spending Policy */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
        {/* Active Cart Card */}
        <div className="fintech-card" style={{ padding: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <ShoppingCart size={16} color="var(--brand-primary)" /> Live Negotiated Cart
            </div>
            {activeCart && activeCart.items.length > 0 && (
              <span className="badge badge-success">{activeCart.items.length} items</span>
            )}
          </div>

          {activeCart && activeCart.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {activeCart.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.45rem 0',
                      borderBottom: '1px solid var(--surface-border)',
                      fontSize: '0.825rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.product_name}
                      </div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                        Qty: {item.quantity} × ₹{((item.unit_price_paise || 0) / 100).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      ₹{((item.subtotal_paise || 0) / 100).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                }}
              >
                <span>Total Amount:</span>
                <span className="font-mono" style={{ color: 'var(--brand-primary)' }}>
                  ₹{((activeCart.total_paise || 0) / 100).toLocaleString('en-IN')}
                </span>
              </div>

              <button
                onClick={() => onSendMessage('Yes, proceed with payment')}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem' }}
              >
                <CreditCard size={16} /> Autonomous Razorpay Checkout
              </button>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Settles immediately on Razorpay Test Rails & SHA-256 ledger
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 0.5rem',
                color: 'var(--text-tertiary)',
                fontSize: '0.825rem',
              }}
            >
              <ShoppingCart size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
              <div>Cart is currently empty.</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Ask the agent to find products or negotiate prices!
              </div>
            </div>
          )}
        </div>

        {/* Autonomous Spending Limits & Guardrails */}
        <div className="fintech-card" style={{ padding: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              marginBottom: '0.85rem',
            }}
          >
            <ShieldCheck size={16} color="var(--success)" /> Spending Guardrails
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.825rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Max Single Transaction:</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>
                ₹{(maxTx / 100).toLocaleString('en-IN')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Daily Spend Budget:</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>
                ₹{(dailyLimit / 100).toLocaleString('en-IN')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Today's Settled Spend:</span>
              <span className="font-mono" style={{ fontWeight: 600, color: 'var(--success)' }}>
                ₹{(todaySpent / 100).toLocaleString('en-IN')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Confirmation Threshold:</span>
              <span className="font-mono" style={{ fontWeight: 600, color: 'var(--warning)' }}>
                &gt; ₹{policy ? (policy.require_confirmation_above_paise / 100).toLocaleString('en-IN') : '4,999'}
              </span>
            </div>

            {/* Budget Utilization Progress Bar */}
            <div style={{ marginTop: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.725rem',
                  color: 'var(--text-tertiary)',
                  marginBottom: '0.25rem',
                }}
              >
                <span>Daily Budget Utilization</span>
                <span className="font-mono">{budgetUtilization}%</span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${budgetUtilization}%`,
                    background: budgetUtilization > 80 ? 'var(--warning)' : 'var(--success)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
