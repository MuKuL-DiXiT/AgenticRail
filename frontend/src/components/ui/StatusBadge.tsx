import React from 'react';
import { CheckCircle2, Clock, XCircle, ShieldCheck, ShieldAlert } from 'lucide-react';

export type StatusType =
  | 'PAID'
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'FAILED'
  | 'ACTIVE'
  | 'ALLOW'
  | 'DENY'
  | 'REQUIRE_CONFIRMATION'
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const normStatus = (status || '').toUpperCase();
  const displayLabel = label || normStatus.replace(/_/g, ' ');

  let variantClass = 'status-badge-neutral';
  let IconComponent: React.ComponentType<{ size: number }> | null = null;

  switch (normStatus) {
    case 'PAID':
    case 'ACTIVE':
    case 'ALLOW':
    case 'IN_STOCK':
      variantClass = 'status-badge-success';
      IconComponent = normStatus === 'ALLOW' ? ShieldCheck : CheckCircle2;
      break;

    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'REQUIRE_CONFIRMATION':
    case 'LOW_STOCK':
      variantClass = 'status-badge-warning';
      IconComponent = Clock;
      break;

    case 'FAILED':
    case 'PAYMENT_FAILED':
    case 'DENY':
    case 'OUT_OF_STOCK':
      variantClass = 'status-badge-danger';
      IconComponent = normStatus === 'DENY' ? ShieldAlert : XCircle;
      break;

    default:
      variantClass = 'status-badge-neutral';
      break;
  }

  const sizeStyles = size === 'sm' ? { fontSize: '0.75rem', padding: '0.15rem 0.5rem' } : { fontSize: '0.8125rem', padding: '0.25rem 0.65rem' };

  return (
    <span className={`status-badge ${variantClass}`} style={sizeStyles}>
      {IconComponent && <IconComponent size={size === 'sm' ? 12 : 14} />}
      <span>{displayLabel}</span>
    </span>
  );
};
