import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface AuditEvent {
  id: string;
  timestamp: string;
  conversation_id: string;
  actor: string;
  event_type: string;
  title: string;
  description: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILURE' | 'INFO';
  metadata?: any;
}

interface MerchantLedgerProps {
  auditEvents: AuditEvent[];
  onVerifyLedger: () => void;
  onTamperLedger: () => void;
  isVerifying: boolean;
  ledgerVerification: { isValid: boolean; reason?: string } | null;
}

export const MerchantLedger: React.FC<MerchantLedgerProps> = ({
  auditEvents,
  onVerifyLedger,
  onTamperLedger,
  isVerifying,
  ledgerVerification,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actorFilter, setActorFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredEvents = auditEvents.filter((evt) => {
    const matchesSearch =
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.actor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActor = actorFilter === 'ALL' || evt.actor.toUpperCase() === actorFilter;
    return matchesSearch && matchesActor;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
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
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Cryptographic Audit Log & SHA-256 Ledger
          </h1>
          <p
            style={{
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Tamper-evident transaction stream recording agent actions, policy evaluations, and Razorpay settlements
          </p>
        </div>

        {/* Verification Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onVerifyLedger}
            disabled={isVerifying}
            className={`btn ${
              ledgerVerification?.isValid
                ? 'btn-secondary'
                : ledgerVerification?.isValid === false
                ? 'btn-danger'
                : 'btn-secondary'
            }`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            <Lock size={14} color="var(--brand-primary)" />
            {isVerifying
              ? 'Verifying Block Hashes...'
              : ledgerVerification?.isValid
              ? '✓ Chain Verified'
              : ledgerVerification?.isValid === false
              ? '🚨 Tamper Detected!'
              : 'Verify Ledger Integrity'}
          </button>

          <button
            onClick={onTamperLedger}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: 'var(--error)' }}
            title="Corrupt database block hash to demonstrate tamper localization"
          >
            <Zap size={14} /> Tamper (Security Demo)
          </button>
        </div>
      </div>

      {/* Ledger Integrity Certificate Banner */}
      <div
        className="fintech-card"
        style={{
          padding: '1.25rem 1.5rem',
          borderLeft: `4px solid ${
            ledgerVerification?.isValid === false
              ? 'var(--error)'
              : 'var(--success)'
          }`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: ledgerVerification?.isValid === false ? 'var(--error-light)' : 'var(--success-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {ledgerVerification?.isValid === false ? (
                <AlertTriangle size={20} color="var(--error)" />
              ) : (
                <ShieldCheck size={20} color="var(--success)" />
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {ledgerVerification?.isValid === false
                  ? 'Cryptographic Verification Failure'
                  : 'Ledger Integrity Status: Verified'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                {ledgerVerification?.isValid === false
                  ? `Malicious corruption detected: ${ledgerVerification.reason || 'Hash mismatch in block sequence'}`
                  : 'All recorded commerce events passed SHA-256 parent-block linkage verification.'}
              </div>
            </div>
          </div>

          <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Algorithm: SHA-256 Hash Chain
          </div>
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
            placeholder="Search audit trail by keyword, actor, or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="fintech-input"
            style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Actor Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'BUYER_AGENT', 'POLICY_ENGINE', 'RAZORPAY', 'LEDGER'].map((actor) => (
            <button
              key={actor}
              onClick={() => setActorFilter(actor)}
              style={{
                border: '1px solid',
                borderColor: actorFilter === actor ? 'var(--brand-primary)' : 'var(--surface-border)',
                background: actorFilter === actor ? 'var(--brand-primary-light)' : '#ffffff',
                color: actorFilter === actor ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {actor === 'ALL' ? 'All Actors' : actor.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="fintech-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="fintech-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}></th>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Event Action</th>
                <th>Description</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt) => {
                const isExpanded = expandedId === evt.id;

                return (
                  <React.Fragment key={evt.id}>
                    <tr
                      onClick={() => toggleExpand(evt.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        {isExpanded ? (
                          <ChevronDown size={14} color="var(--text-secondary)" />
                        ) : (
                          <ChevronRight size={14} color="var(--text-tertiary)" />
                        )}
                      </td>

                      <td className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {new Date(evt.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            color: 'var(--text-primary)',
                            background: 'var(--bg-canvas)',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid var(--surface-border)',
                          }}
                        >
                          {evt.actor}
                        </span>
                      </td>

                      <td style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {evt.title}
                      </td>

                      <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                        {evt.description}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            evt.status === 'SUCCESS'
                              ? 'status-success'
                              : evt.status === 'WARNING'
                              ? 'status-warning'
                              : evt.status === 'FAILURE'
                              ? 'status-error'
                              : 'status-info'
                          }`}
                        >
                          {evt.status === 'SUCCESS' && '✓ SUCCESS'}
                          {evt.status === 'WARNING' && '● WARNING'}
                          {evt.status === 'FAILURE' && '✕ FAILED'}
                          {evt.status === 'INFO' && 'ℹ INFO'}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ padding: '0.85rem 1.5rem', background: 'var(--bg-canvas)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Cryptographic Event Payload & Metadata:
                            </div>
                            <pre
                              className="font-mono"
                              style={{
                                background: '#ffffff',
                                border: '1px solid var(--surface-border)',
                                borderRadius: '6px',
                                padding: '0.75rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-primary)',
                                margin: 0,
                                overflowX: 'auto',
                              }}
                            >
                              {JSON.stringify(
                                {
                                  event_id: evt.id,
                                  conversation_id: evt.conversation_id,
                                  actor: evt.actor,
                                  event_type: evt.event_type,
                                  timestamp: evt.timestamp,
                                  metadata: evt.metadata,
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)' }}>
                    No audit records match the current filter.
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
