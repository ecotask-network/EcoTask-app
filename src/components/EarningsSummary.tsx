import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, sumRewards, groupByTaskType, computeWeeklySeries } from '../utils/earnings';

interface EarningsSummaryProps {
  activities: Activity[];
  title?: string;
}

/**
 * EarningsSummary component optimized with useMemo
 * Computations only run when activities content actually changes
 */
export const EarningsSummary: React.FC<EarningsSummaryProps> = ({
  activities,
  title = 'Earnings Summary',
}) => {
  // Memoize total rewards - only recalculates when activities changes
  const totalRewards = useMemo(() => {
    return sumRewards(activities);
  }, [activities]);

  // Memoize grouped breakdown - uses pre-computed total to avoid double work
  const earningsBreakdown = useMemo(() => {
    return groupByTaskType(activities, totalRewards);
  }, [activities, totalRewards]);

  // Memoize weekly series - only recalculates when activities changes
  const weeklySeries = useMemo(() => {
    return computeWeeklySeries(activities, 8);
  }, [activities]);

  // Memoize task type list for rendering
  const taskTypes = useMemo(() => {
    return Object.entries(earningsBreakdown.byTaskType);
  }, [earningsBreakdown.byTaskType]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {/* Total Rewards */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalAmount}>${totalRewards.toFixed(2)}</Text>
        <Text style={styles.totalLabel}>Total Rewards</Text>
      </View>

      {/* Breakdown by Task Type */}
      <View style={styles.breakdownContainer}>
        <Text style={styles.sectionTitle}>By Task Type</Text>
        {taskTypes.map(([type, amount]) => (
          <View key={type} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{type}</Text>
            <Text style={styles.breakdownAmount}>${amount.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Weekly Series */}
      <View style={styles.weeklyContainer}>
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        <View style={styles.weeklyChart}>
          {weeklySeries.map((week) => (
            <View key={week.week} style={styles.weeklyBarContainer}>
              <View style={[styles.weeklyBar, { height: Math.max(4, (week.amount / Math.max(1, totalRewards)) * 60) }]} />
              <Text style={styles.weeklyLabel}>{week.week}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  totalContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#28a745',
  },
  totalLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  breakdownContainer: {
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#495057',
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
  },
  weeklyContainer: {
    marginTop: 8,
  },
  weeklyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 80,
    paddingTop: 8,
  },
  weeklyBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  weeklyBar: {
    width: 20,
    backgroundColor: '#007bff',
    borderRadius: 4,
    minHeight: 4,
  },
  weeklyLabel: {
    fontSize: 10,
    color: '#6c757d',
    marginTop: 4,
  },
});
