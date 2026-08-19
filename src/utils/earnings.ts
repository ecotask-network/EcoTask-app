/**
 * Earnings utilities - optimized with memoization support
 */

export interface Activity {
  id: string;
  taskType: string;
  reward: number;
  completedAt: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface EarningsBreakdown {
  total: number;
  byTaskType: Record<string, number>;
}

export interface WeeklySeriesData {
  week: string;
  amount: number;
}

/**
 * Sum rewards from activities - O(n)
 * Pure function, can be memoized
 */
export function sumRewards(activities: Activity[]): number {
  return activities.reduce((sum, activity) => sum + (activity.reward || 0), 0);
}

/**
 * Group rewards by task type - O(n)
 * Can accept pre-computed total to avoid double work
 * 
 * @param activities - The activities to group
 * @param preComputedTotal - Optional pre-computed total (avoids extra sum)
 */
export function groupByTaskType(
  activities: Activity[],
  preComputedTotal?: number,
): EarningsBreakdown {
  const byTaskType: Record<string, number> = {};

  for (const activity of activities) {
    const type = activity.taskType || 'unknown';
    byTaskType[type] = (byTaskType[type] || 0) + (activity.reward || 0);
  }

  // Use pre-computed total if provided, otherwise calculate
  const total = preComputedTotal !== undefined ? preComputedTotal : sumRewards(activities);

  return {
    total,
    byTaskType,
  };
}

/**
 * Compute weekly earnings series - O(n * weeks)
 * Memoize this to avoid unnecessary nested loops
 * 
 * @param activities - The activities to analyze
 * @param weeks - Number of weeks to include (default: 8)
 */
export function computeWeeklySeries(
  activities: Activity[],
  weeks: number = 8,
): WeeklySeriesData[] {
  if (activities.length === 0) {
    return [];
  }

  // Group activities by week
  const weekMap = new Map<string, number>();

  // Only process completed activities for the series
  for (const activity of activities) {
    if (activity.status !== 'completed') continue;

    const date = new Date(activity.completedAt);
    // Get the start of the week (Monday)
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + (activity.reward || 0));
  }

  // Get the last 'weeks' weeks
  const series: WeeklySeriesData[] = [];
  const now = new Date();
  
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    const amount = weekMap.get(weekKey) || 0;
    const weekLabel = formatWeekLabel(weekStart);
    
    series.push({
      week: weekLabel,
      amount,
    });
  }

  return series;
}

/**
 * Get the start of the week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1); // Monday as first day
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format week label
 */
function formatWeekLabel(date: Date): string {
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

/**
 * Create an optimized memoized selector for earnings data
 * This can be used with useMemo or reselect
 */
export function computeEarningsData(activities: Activity[]) {
  // Single pass for total
  const total = sumRewards(activities);
  
  // Single pass for grouping (using pre-computed total)
  const breakdown = groupByTaskType(activities, total);
  
  // Single pass for weekly series
  const weeklySeries = computeWeeklySeries(activities);
  
  return {
    total,
    byTaskType: breakdown.byTaskType,
    weeklySeries,
  };
}
