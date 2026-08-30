import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing } from '../utils/theme';
import { Activity } from '../types';
import {
  sumRewards,
  groupByTaskType,
  computeWeeklySeries,
} from '../utils/earnings';

interface EarningsSummaryProps {
  activities: Activity[];
}

export default function EarningsSummary({ activities }: EarningsSummaryProps) {
  const { confirmed, pending } = sumRewards(activities);
  const byType = groupByTaskType(activities);
  const weekly = computeWeeklySeries(activities);
  const maxWeek = Math.max(...weekly.map(w => w.earned), 1);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
          Earnings
        </Text>
        {pending > 0 && (
          <Text style={{ color: colors.warning, fontSize: 12 }}>
            {pending} pending
          </Text>
        )}
      </View>

      <View
        style={{
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Total earned
        </Text>
        <Text
          style={{
            color: colors.primary,
            fontSize: 28,
            fontWeight: 'bold',
          }}
        >
          {confirmed}{' '}
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>ECO</Text>
        </Text>
      </View>

      {byType.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginBottom: spacing.xs,
            }}
          >
            By task type
          </Text>
          {byType.map(item => (
            <View
              key={item.type}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: spacing.xs,
              }}
            >
              <Text accessible={true} accessibilityRole="image" accessibilityLabel={`${item.label} icon`} style={{ fontSize: 14, width: 24 }}>{item.icon}</Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 12,
                  width: 90,
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.surface,
                  marginHorizontal: spacing.sm,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.round(item.share * 100)}%`,
                    height: '100%',
                    backgroundColor: colors.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {item.count}× {item.total}
              </Text>
            </View>
          ))}
        </View>
      )}

      {weekly.some(w => w.earned > 0) && (
        <View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginBottom: spacing.xs,
            }}
          >
            Last 4 weeks
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {weekly.map(w => (
              <View
                key={w.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  marginHorizontal: 2,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 9 }}>
                  {w.earned > 0 ? w.earned : ''}
                </Text>
                <View
                  style={{
                    width: '100%',
                    height: 40,
                    justifyContent: 'flex-end',
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(4, (w.earned / maxWeek) * 36),
                      backgroundColor:
                        w.earned > 0 ? colors.primary : colors.surface,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 8,
                    marginTop: spacing.xs,
                  }}
                  numberOfLines={1}
                >
                  {w.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
