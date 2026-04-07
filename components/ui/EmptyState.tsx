import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  emoji?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ emoji = '📭', title, subtitle }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text style={{ fontSize: 56, marginBottom: 16 }}>{emoji}</Text>
      <Text className="text-body text-center font-semibold text-lg mb-2">{title}</Text>
      {subtitle ? (
        <Text className="text-muted text-center text-sm leading-5">{subtitle}</Text>
      ) : null}
    </View>
  );
}
