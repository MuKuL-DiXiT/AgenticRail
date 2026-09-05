import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon | React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  isAlert?: boolean;
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  isAlert = false,
  badge,
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as LucideIcon;
    return <IconComponent size={16} />;
  };

  return (
    <div
      className="fintech-card fintech-card-hover"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderColor: isAlert ? 'var(--semantic-danger-border)' : 'var(--surface-border)',
        background: isAlert ? '#fffbfa' : '#ffffff',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {badge && (
              <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                {badge}
              </span>
            )}
            {icon && (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: isAlert ? 'var(--semantic-danger-bg)' : 'var(--surface-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isAlert ? 'var(--semantic-danger-text)' : 'var(--text-secondary)',
                }}
              >
                {renderIcon()}
              </div>
            )}
          </div>
        </div>

        <div
          className="font-mono"
          style={{
            fontSize: '1.625rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: isAlert ? 'var(--semantic-danger-text)' : 'var(--text-primary)',
          }}
        >
          {value}
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
        {trend && (
          <span
            style={{
              fontWeight: 600,
              color: trend.isPositive ? 'var(--semantic-success-text)' : 'var(--semantic-danger-text)',
            }}
          >
            {trend.value}
          </span>
        )}
        {subtitle && (
          <span style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
