import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  fullScreen?: boolean;
  color?: string;
  size?: number;
}

export function LoadingSpinner({ fullScreen = false, color = Colors.primary, size = 36 }: Props) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: Colors.pageBg }}>
        <ActivityIndicator size={size} color={color} />
      </View>
    );
  }
  return (
    <View className="items-center justify-center py-8">
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}
