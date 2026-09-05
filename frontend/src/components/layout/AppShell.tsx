import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp,
  Store,
  ShoppingCart,
  Sliders,
  FileCode,
  History,
  Bot,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Zap,
  LogOut,
  User as UserIcon,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Layers,
} from 'lucide-react';

interface AppShellProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  simulateFailure: boolean;
  onToggleFailure: () => void;
  onVerifyLedger: () => void;
  onTamperLedger: () => void;
  onRepairLedger?: () => void;
  isVerifying: boolean;
  ledgerVerification: { isValid: boolean; reason?: string } | null;
  onOpenAuth: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  children,
  simulateFailure,
  onToggleFailure,
  onVerifyLedger,
  onTamperLedger,
  onRepairLedger,
  isVerifying,
  ledgerVerification,
  onOpenAuth,
}) => {
  const { user, logout, demoLogin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Grouped Navigation based on Authenticated Role
  const merchantNav = [
    {
      group: 'OPERATIONS',
      items: [
        { id: 'overview', label: 'Overview', icon: TrendingUp },
        { id: 'catalog', label: 'Products & Inventory', icon: Store },
        { id: 'orders', label: 'Orders & Payments', icon: ShoppingCart },
      ],
    },
    {
      group: 'AGENTIC COMMERCE',
      items: [
        { id: 'growth', label: 'AI Growth Engine', icon: Layers },
        { id: 'policies', label: 'Merchant Policies', icon: Sliders },
        { id: 'manifest', label: 'Agent Capability Manifest', icon: FileCode },
      ],
    },
    {
      group: 'TRUST & VERIFICATION',
      items: [
        { id: 'audit', label: 'Ledger & Audit Trail', icon: History },
        { id: 'settings', label: 'Diagnostics & Test Rails', icon: CreditCard },
      ],
    },
  ];

  const buyerNav = [
    {
      group: 'SHOPPING',
      items: [
        { id: 'chat', label: 'AI Shopping Assistant', icon: Bot },
        { id: 'catalog', label: 'Browse Products', icon: Store },
        { id: 'orders', label: 'My Orders & Receipts', icon: ShoppingCart },
      ],
    },
    {
      group: 'GUARDRAILS & AUDIT',
      items: [
        { id: 'policies', label: 'Autonomous Spending Limits', icon: ShieldCheck },
        { id: 'activity', label: 'Agent Reasoning & Actions', icon: Terminal },
        { id: 'audit', label: 'Transaction Audit Trail', icon: History },
      ],
    },
  ];

  const currentNav = user?.role === 'MERCHANT' ? merchantNav : buyerNav;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      {/* 1. FIXED LEFT SIDEBAR */}
      <aside
        style={{
          width: '240px',
          background: '#ffffff',
          borderRight: '1px solid var(--surface-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
          flexShrink: 0,
        }}
        className={mobileMenuOpen ? 'block' : 'hidden md:flex'}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.25rem 1.25rem 1rem',
            borderBottom: '1px solid var(--surface-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#d92d20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 4px rgba(217, 45, 32, 0.25)',
              }}
            >
              <CreditCard size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                AgentCart
              </div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Fintech Rails
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Identity Tag */}
        <div style={{ padding: '0.875rem 1.25rem 0.5rem' }}>
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: user?.role === 'MERCHANT' ? '#fdf2f8' : '#f0f9ff',
              border: `1px solid ${user?.role === 'MERCHANT' ? '#fbcfe8' : '#e0f2fe'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: user?.role === 'MERCHANT' ? '#db2777' : '#0284c7',
                }}
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: user?.role === 'MERCHANT' ? '#9d174d' : '#0369a1',
                }}
              >
                {user?.role === 'MERCHANT' ? 'Merchant Portal' : 'Buyer Portal'}
              </span>
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {user ? user.name.split(' ')[0] : 'Guest'}
            </span>
          </div>
        </div>

        {/* Grouped Navigation Links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
          {currentNav.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.25rem 0.5rem 0.35rem',
                }}
              >
                {section.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setMobileMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: isActive ? 'var(--brand-red-light)' : 'transparent',
                        color: isActive ? 'var(--brand-red)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 500,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.1s ease',
                        borderLeft: isActive ? '3px solid var(--brand-red)' : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: Rails Status & Account Switch */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--surface-border-subtle)',
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
          }}
        >
          {/* Shared Platform Rails Pill */}
          <div
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              background: '#ecfdf3',
              border: '1px solid #abefc6',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.725rem',
              color: '#027a48',
              fontWeight: 500,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#12b76a' }} />
            <span>Razorpay Test Rails: Active</span>
          </div>

          {/* Role Switching */}
          {user ? (
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {user.role === 'BUYER' ? (
                <button
                  onClick={() => demoLogin('MERCHANT')}
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                  title="Switch to Merchant View"
                >
                  <Store size={13} /> Switch Merchant
                </button>
              ) : (
                <button
                  onClick={() => demoLogin('BUYER')}
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                  title="Switch to Buyer View"
                >
                  <Bot size={13} /> Switch Buyer
                </button>
              )}
              <button
                onClick={logout}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}
                title="Log Out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.75rem' }}
            >
              Sign In / Register
            </button>
          )}
        </div>
      </aside>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '60px',
            background: '#ffffff',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Mobile menu toggle & Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden btn btn-secondary"
              style={{ padding: '0.35rem' }}
            >
              <Menu size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {activeTab.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ')}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {user?.role === 'MERCHANT' ? 'UrbanFit Storefront' : 'Autonomous Session'}
              </span>
            </div>
          </div>

          {/* Header Actions: Diagnostics, Ledger verification, User menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Failure Mode Toggle */}
            <button
              onClick={onToggleFailure}
              className={`btn ${simulateFailure ? 'btn-danger' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
              title="Test payment failure handling"
            >
              <AlertTriangle size={13} />
              <span>{simulateFailure ? 'Failure: ON' : 'Failure: OFF'}</span>
            </button>

            {/* Verify Ledger Button */}
            <button
              onClick={onVerifyLedger}
              disabled={isVerifying}
              className={`btn ${
                ledgerVerification?.isValid
                  ? 'btn-success'
                  : ledgerVerification?.isValid === false
                  ? 'btn-danger'
                  : 'btn-secondary'
              }`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
            >
              <Lock size={13} />
              <span>{isVerifying ? 'Checking...' : ledgerVerification?.isValid ? 'Chain Verified' : ledgerVerification?.isValid === false ? 'TAMPER DETECTED' : 'Verify Ledger'}</span>
            </button>

            {/* Restore/Repair Ledger Button */}
            {onRepairLedger && ledgerVerification?.isValid === false && (
              <button
                onClick={onRepairLedger}
                className="btn btn-success"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                title="Repair broken hash chain and restore cryptographic integrity"
              >
                <ShieldCheck size={13} />
                <span>Restore Chain</span>
              </button>
            )}

            {/* Tamper Button for Demo */}
            <button
              onClick={onTamperLedger}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', color: 'var(--semantic-danger-text)' }}
              title="Simulate SHA-256 block corruption"
            >
              <Zap size={13} />
              <span>Tamper (Demo)</span>
            </button>

            {/* User Profile */}
            {user ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '8px',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#e0e2ec',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475467',
                  }}
                >
                  <UserIcon size={13} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.name}
                </span>
              </div>
            ) : (
              <button onClick={onOpenAuth} className="btn btn-primary" style={{ fontSize: '0.75rem' }}>
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Page Canvas */}
        <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
