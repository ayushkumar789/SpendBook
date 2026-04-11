import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.5;

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: number;
}

export function BottomSheet({ visible, onClose, title, children, maxHeight = SCREEN_HEIGHT * 0.85 }: Props) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),

      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },

      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_THRESHOLD || gesture.vy > VELOCITY_THRESHOLD) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },

      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
      },
    })
  ).current;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[
        styles.sheet,
        { transform: [{ translateY }], maxHeight, backgroundColor: colors.card },
      ]}>
        <View style={styles.handleContainer} {...panResponder.panHandlers}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {title ? (
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.body }]}>{title}</Text>
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  handleContainer: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
});
