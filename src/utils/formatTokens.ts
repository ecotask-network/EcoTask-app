export function formatTokenAmount(
  amount: number | string,
  decimals = 2,
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return '0';
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

export function formatReward(amount: number, token = 'ECO'): string {
  return `${formatTokenAmount(amount)} ${token}`;
}

/**
 * Format a USDC amount.
 * USDC is a USD-pegged stablecoin — always display with 2 decimal places
 * regardless of the raw Stellar balance precision (7 decimal places).
 */
export function formatUsdc(amount: number | string): string {
  return formatTokenAmount(amount, 2);
}
