/**
 * Formats integer paise into Indian Rupee display string.
 * Example: 9500 -> "₹95", 9550 -> "₹95.50"
 */
export function formatRupees(paise: number): string {
  if (isNaN(paise) || paise === 0) return '₹0';
  const rupees = paise / 100;
  if (paise % 100 === 0) {
    return `₹${rupees.toLocaleString('en-IN')}`;
  }
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Returns rupee amount as decimal number for calculations if needed
 */
export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

/**
 * Formats ISO date time into clean readable IST string
 */
export function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1m ago';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ${diffMins % 60}m ago`;
}

export function formatTimeOnly(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export function formatDateShort(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
