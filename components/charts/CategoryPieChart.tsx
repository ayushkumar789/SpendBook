import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Transaction } from '../../constants/types';
import { Colors } from '../../constants/colors';
import { getCategoryByKey } from '../../constants/categories';
import { formatCurrency } from '../../lib/format';

interface Props {
  transactions: Transaction[];
}

interface Slice {
  category: string;
  label: string;
  emoji: string;
  amount: number;
  percent: number;
  color: string;
}

export function CategoryPieChart({ transactions }: Props) {
  const slices = useMemo<Slice[]>(() => {
    const outTxns = transactions.filter((t) => t.type === 'out');
    const total = outTxns.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return [];

    const map: Record<string, number> = {};
    outTxns.forEach((t) => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });

    return Object.entries(map)
      .map(([cat, amount], i) => {
        const catData = getCategoryByKey(cat);
        return {
          category: cat,
          label: catData?.label ?? cat,
          emoji: catData?.emoji ?? '💰',
          amount,
          percent: (amount / total) * 100,
          color: Colors.chartColors[i % Colors.chartColors.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  if (slices.length === 0) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <Text style={{ color: Colors.muted, fontSize: 13 }}>No expense data yet</Text>
      </View>
    );
  }

  // Simple donut approximation using segmented bars
  const total = slices.reduce((s, sl) => s + sl.amount, 0);

  return (
    <View>
      {/* Segmented bar */}
      <View
        style={{
          flexDirection: 'row',
          height: 20,
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {slices.map((sl, i) => (
          <View
            key={i}
            style={{ flex: sl.amount / total, backgroundColor: sl.color }}
          />
        ))}
      </View>

      {/* Legend */}
      {slices.map((sl, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: sl.color,
              marginRight: 8,
            }}
          />
          <Text style={{ fontSize: 13, flex: 1, color: Colors.body }}>
            {sl.emoji} {sl.label}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.muted, marginRight: 8 }}>
            {sl.percent.toFixed(1)}%
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.cashOut }}>
            {formatCurrency(sl.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}
