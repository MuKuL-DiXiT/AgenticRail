import React from 'react';
import { CheckCircle2, Bot } from 'lucide-react';

interface AgentAction {
  id: string;
  conversation_id: string;
  agent_id: string;
  action_type: string;
  summary: string;
  inputs: any;
  result: any;
  policy_verdict?: string;
  timestamp: string;
}

interface BuyerActivityProps {
  agentActions: AgentAction[];
}

export const BuyerActivity: React.FC<BuyerActivityProps> = ({ agentActions }) => {
  const pipelineSteps = [
    'UNDERSTAND_INTENT',
    'SEARCH_CATALOG',
    'EVALUATE_PRODUCTS',
    'RECOMMEND',
    'BUILD_CART',
    'CALCULATE_TOTAL',
    'CHECK_POLICY',
    'REQUEST_CONFIRMATION',
    'CREATE_ORDER',
    'REQUEST_PAYMENT',
    'PAYMENT_CONFIRMED',
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
          Agent Reasoning & Autonomous Execution Graph
        </h1>
        <p
          style={{
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            marginTop: '0.2rem',
            margin: 0,
          }}
        >
          Real-time step-by-step logs of AI agent intent parsing, catalog evaluations, and policy checks
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Decision Stream */}
        <div className="fintech-card" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
            Structured Agent Decision Log ({agentActions.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '580px', overflowY: 'auto' }}>
            {agentActions.map((action) => (
              <div
                key={action.id}
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: 'var(--brand-primary)',
                      background: 'var(--brand-primary-light)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    {action.action_type}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }} className="font-mono">
                    {new Date(action.timestamp).toLocaleTimeString('en-IN')}
                  </span>
                </div>

                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {action.summary}
                </div>

                <pre
                  className="font-mono"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--surface-border)',
                    padding: '0.55rem',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    overflowX: 'auto',
                    maxHeight: '140px',
                  }}
                >
                  {JSON.stringify({ inputs: action.inputs, result: action.result }, null, 2)}
                </pre>
              </div>
            ))}

            {agentActions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                <Bot size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                <div>No agent actions recorded yet.</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                  Ask the shopping assistant to initiate a search.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Execution State Machine Graph */}
        <div className="fintech-card" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
            Deterministic State Machine
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {pipelineSteps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '6px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--surface-border)',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    className="font-mono"
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: '1px solid var(--surface-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {step}
                  </span>
                </div>
                <CheckCircle2 size={14} color="var(--success)" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
