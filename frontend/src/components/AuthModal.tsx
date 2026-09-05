import React, { useState } from 'react';
import { useAuth, type UserRole } from '../context/AuthContext';
import { X, Lock, Mail, User, Store, ShieldCheck, Zap, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultRole = 'BUYER' }) => {
  const { login, register, demoLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>(defaultRole);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [merchantName, setMerchantName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          name,
          role,
          merchantName: role === 'MERCHANT' ? merchantName : undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoClick = async (demoRole: UserRole) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await demoLogin(demoRole);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(16, 24, 40, 0.45)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="fintech-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          background: '#ffffff',
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--surface-border)',
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
                background: 'var(--brand-red-light)',
                border: '1px solid var(--brand-red-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-red)',
              }}
            >
              <Lock size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {mode === 'login' ? 'Sign In to AgentCart' : 'Create AgentCart Account'}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Secure AI Commerce Infrastructure
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle: Sign In vs Register */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-border)', background: '#fafafa' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '0.75rem 0',
              fontSize: '0.875rem',
              fontWeight: mode === 'login' ? 600 : 500,
              color: mode === 'login' ? 'var(--brand-red)' : 'var(--text-secondary)',
              background: mode === 'login' ? '#ffffff' : 'transparent',
              border: 'none',
              borderBottom: mode === 'login' ? '2px solid var(--brand-red)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            style={{
              flex: 1,
              padding: '0.75rem 0',
              fontSize: '0.875rem',
              fontWeight: mode === 'register' ? 600 : 500,
              color: mode === 'register' ? 'var(--brand-red)' : 'var(--text-secondary)',
              background: mode === 'register' ? '#ffffff' : 'transparent',
              border: 'none',
              borderBottom: mode === 'register' ? '2px solid var(--brand-red)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'var(--semantic-danger-bg)',
                border: '1px solid var(--semantic-danger-border)',
                color: 'var(--semantic-danger-text)',
                fontSize: '0.8125rem',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mode === 'register' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Account Role
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                    <button
                      type="button"
                      onClick={() => setRole('BUYER')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${role === 'BUYER' ? 'var(--brand-red)' : 'var(--surface-border)'}`,
                        background: role === 'BUYER' ? 'var(--brand-red-light)' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8125rem', color: role === 'BUYER' ? 'var(--brand-red)' : 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        <ShieldCheck size={14} /> Buyer
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                        Autonomous AI shopping & spending limits
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('MERCHANT')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${role === 'MERCHANT' ? 'var(--brand-red)' : 'var(--surface-border)'}`,
                        background: role === 'MERCHANT' ? 'var(--brand-red-light)' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8125rem', color: role === 'MERCHANT' ? 'var(--brand-red)' : 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        <Store size={14} /> Merchant
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                        Catalog, orders & manifest operations
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={role === 'BUYER' ? 'Rahul Sharma' : 'Merchant Admin'}
                      className="fintech-input"
                      style={{ paddingLeft: '2rem' }}
                    />
                  </div>
                </div>

                {role === 'MERCHANT' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Business / Store Name
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Store size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        required
                        value={merchantName}
                        onChange={(e) => setMerchantName(e.target.value)}
                        placeholder="UrbanFit Athletics"
                        className="fintech-input"
                        style={{ paddingLeft: '2rem' }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="fintech-input"
                  style={{ paddingLeft: '2rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="fintech-input"
                  style={{ paddingLeft: '2rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.625rem', fontSize: '0.875rem', marginTop: '0.25rem' }}
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Dashboard' : 'Create Account'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Buttons for Hackathon Judges */}
          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--surface-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Zap size={13} color="#d92d20" />
              <span>Instant Demo Accounts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDemoClick('BUYER')}
                className="btn btn-secondary"
                style={{ textAlign: 'left', padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Demo Buyer
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Rahul Sharma</div>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDemoClick('MERCHANT')}
                className="btn btn-secondary"
                style={{ textAlign: 'left', padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Demo Merchant
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>UrbanFit Admin</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
