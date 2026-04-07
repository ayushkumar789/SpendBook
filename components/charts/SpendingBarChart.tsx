import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Transaction } from '../../constants/types';
import { Colors } from '../../constants/colors';
import { monthLabel } from '../../lib/format';
import { subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

interface Props {
  transactions: Transaction[];
}

interface MonthData {
  label: string;
  cashIn: number;
  cashOut: number;
}

export function SpendingBarChart({ transactions }: Props) {
  const months = useMemo<MonthData[]>(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inMonth = transactions.filter((t) => {
        try {
          return isWithinInterval(parseISO(t.date), { start, end });
        } catch {
          return false;
        }
      });
      const cashIn = inMonth.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
      const cashOut = inMonth.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
      return { label: monthLabel(d), cashIn, cashOut };
    });
  }, [transactions]);

  const maxVal = Math.max(...months.flatMap((m) => [m.cashIn, m.cashOut]), 1);
  const chartHeight = 120;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4 }}>
          {months.map((m, i) => {
            const inH = Math.max((m.cashIn / maxVal) * chartHeight, m.cashIn > 0 ? 4 : 0);
            const outH = Math.max((m.cashOut / maxVal) * chartHeight, m.cashOut > 0 ? 4 : 0);
            return (
              <View key={i} style={{ alignItems: 'center', marginHorizontal: 6, width: 44 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight }}>
                  <View
                    style={{
                      width: 14,
                      height: inH,
                      backgroundColor: Colors.cashIn,
                      borderRadius: 3,
                      marginRight: 2,
                    }}
                  />
                  <View
                    style={{
                      width: 14,
                      height: outH,
                      backgroundColor: Colors.cashOut,
                      borderRadius: 3,
                    }}
                  />
                </View>
                <Text
                  style={{ fontSize: 10, color: Colors.muted, marginTop: 4, textAlign: 'center' }}
                  numberOfLines={1}
                >
                  {m.label}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.cashIn }} />
          <Text style={{ fontSize: 11, color: Colors.muted }}>Cash In</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.cashOut }} />
          <Text style={{ fontSize: 11, color: Colors.muted }}>Cash Out</Text>
        </View>
      </View>
    </View>
  );
}
