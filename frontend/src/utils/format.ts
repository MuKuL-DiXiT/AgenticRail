/**
 * Formats an amount in paise to show paise first and rupee value in brackets.
 * Example: formatPaise(499900) => "4,99,900 paise (₹4,999)"
 * Example: formatPaise(49900) => "49,900 paise (₹499)"
 * Example: formatPaise(0) => "0 paise (₹0)"
 */
export function formatPaise(paise: number | undefined | null): string {
  const val = Math.round(Number(paise) || 0);
  const rupees = val / 100;
  const paiseStr = val.toLocaleString('en-IN');
  const rupeesStr = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: val % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${paiseStr} paise (₹${rupeesStr})`;
}
