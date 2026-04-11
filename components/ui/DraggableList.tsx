/**
 * DraggableList — drag-to-reorder list using React Native's built-in
 * PanResponder + Animated. No react-native-reanimated required.
 *
 * Each item shows a drag handle (reorder-three-outline icon) on the right.
 * The dragged item becomes a floating "ghost" that follows the finger.
 * Other items shift to indicate the drop position.
 * On release the new order is emitted via onReorder.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  /** Return the row JSX. isDragging=true when this item is the ghost copy. */
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  /** Called whenever the user drops an item in a new position. */
  onReorder: (newItems: T[]) => void;
  /** When false the handle is hidden and gestures are blocked. */
  enabled: boolean;
  /**
   * Extra vertical space between items (e.g. the row's marginBottom).
   * Used so the ghost top-offset and hover detection account for gaps.
   */
  itemGap?: number;
}

export function DraggableList<T>({
  items,
  keyExtractor,
  renderItem,
  onReorder,
  enabled,
  itemGap = 0,
}: Props<T>) {
  const [localItems, setLocalItems] = useState<T[]>(items);

  // Always-current refs for values used inside PanResponder callbacks
  const localItemsRef = useRef(localItems);
  localItemsRef.current = localItems;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const itemGapRef = useRef(itemGap);
  itemGapRef.current = itemGap;

  // Sync external items into local state when we're not mid-drag
  useEffect(() => {
    if (!dragKeyRef.current) setLocalItems(items);
  }, [items]);

  const containerRef = useRef<View>(null);
  const containerPageY = useRef(0);
  /** Measured row height (excl. gap) keyed by item key */
  const heightById = useRef<Record<string, number>>({});

  const dragKeyRef = useRef<string | null>(null);
  const hoverIdxRef = useRef(-1);
  const dragAnimY = useRef(new Animated.Value(0)).current;

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState(-1);

  // PanResponder instances keyed by item key — created once, live forever
  const panRefs = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Full slot height = measured row height + gap */
  function slotH(key: string): number {
    return (heightById.current[key] ?? 64) + itemGapRef.current;
  }

  /** Y offset from container top to the start of the item at `index` */
  function getTopOffset(index: number): number {
    let y = 0;
    for (let i = 0; i < index; i++) {
      y += slotH(keyExtractor(localItemsRef.current[i]));
    }
    return y;
  }

  /** Which list index does pageY map to? */
  function idxAtPageY(pageY: number): number {
    const localY = pageY - containerPageY.current;
    let y = 0;
    const arr = localItemsRef.current;
    for (let i = 0; i < arr.length; i++) {
      const h = slotH(keyExtractor(arr[i]));
      if (localY < y + h * 0.55) return i;
      y += h;
    }
    return arr.length - 1;
  }

  // ── per-item pan responder factory ────────────────────────────────────────

  function getOrCreatePR(itemKey: string) {
    if (panRefs.current[itemKey]) return panRefs.current[itemKey];

    panRefs.current[itemKey] = PanResponder.create({
      // Use capture phase so this responder wins over parent ScrollView
      onStartShouldSetPanResponderCapture: () => enabledRef.current,
      onMoveShouldSetPanResponderCapture: () => enabledRef.current,

      onPanResponderGrant: () => {
        // Capture the container's current page-Y so offset calcs are correct
        containerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
          containerPageY.current = py;
        });
        dragAnimY.setValue(0);
        dragKeyRef.current = itemKey;
        const idx = localItemsRef.current.findIndex((it) => keyExtractor(it) === itemKey);
        hoverIdxRef.current = idx;
        setActiveKey(itemKey);
        setHoverIdx(idx);
      },

      onPanResponderMove: (e, g) => {
        dragAnimY.setValue(g.dy);
        const ni = idxAtPageY(e.nativeEvent.pageY);
        if (ni !== hoverIdxRef.current) {
          hoverIdxRef.current = ni;
          setHoverIdx(ni);
        }
      },

      onPanResponderRelease: () => {
        const fromKey = dragKeyRef.current;
        const toIdx = hoverIdxRef.current;
        dragKeyRef.current = null;
        dragAnimY.setValue(0);
        setActiveKey(null);
        setHoverIdx(-1);

        if (fromKey !== null) {
          const fromIdx = localItemsRef.current.findIndex((it) => keyExtractor(it) === fromKey);
          if (fromIdx !== toIdx && fromIdx >= 0 && toIdx >= 0) {
            setLocalItems((prev) => {
              const next = [...prev];
              const [moved] = next.splice(fromIdx, 1);
              next.splice(toIdx, 0, moved);
              onReorderRef.current(next);
              return next;
            });
          }
        }
      },

      onPanResponderTerminate: () => {
        dragKeyRef.current = null;
        dragAnimY.setValue(0);
        setActiveKey(null);
        setHoverIdx(-1);
      },
    });

    return panRefs.current[itemKey];
  }

  // ── derived values ─────────────────────────────────────────────────────────

  const activeIdx = activeKey
    ? localItems.findIndex((it) => keyExtractor(it) === activeKey)
    : -1;
  const ghostTop = activeIdx >= 0 ? getTopOffset(activeIdx) : 0;
  const dragSlotH = activeKey ? slotH(activeKey) : 64;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <View ref={containerRef}>
      {localItems.map((item, i) => {
        const k = keyExtractor(item);
        const pr = getOrCreatePR(k);
        const isDragging = activeKey === k;

        // How much should this item shift to show the drop target?
        let shift = 0;
        if (activeIdx >= 0 && !isDragging) {
          if (activeIdx < hoverIdx && i > activeIdx && i <= hoverIdx) {
            shift = -dragSlotH; // dragging down: items above the target shift up
          } else if (activeIdx > hoverIdx && i >= hoverIdx && i < activeIdx) {
            shift = dragSlotH;  // dragging up: items below the target shift down
          }
        }

        return (
          <View
            key={k}
            style={{ opacity: isDragging ? 0 : 1 }}
            onLayout={(e) => { heightById.current[k] = e.nativeEvent.layout.height; }}
          >
            <Animated.View style={shift ? { transform: [{ translateY: shift }] } : undefined}>
              {renderItem(item, isDragging)}
            </Animated.View>

            {/* Drag handle — absolutely overlays the right edge of the row */}
            {enabled && (
              <View style={handleStyle} {...pr.panHandlers}>
                <Ionicons name="reorder-three-outline" size={22} color="#94a3b8" />
              </View>
            )}
          </View>
        );
      })}

      {/* Ghost — floating copy of the active item that follows the finger */}
      {activeKey !== null && activeIdx >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: ghostTop,
            zIndex: 100,
            elevation: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.18,
            shadowRadius: 10,
            transform: [{ translateY: dragAnimY }],
          }}
        >
          {renderItem(localItems[activeIdx], true)}
          <View style={handleStyle}>
            <Ionicons name="reorder-three-outline" size={22} color="#94a3b8" />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const handleStyle = {
  position: 'absolute' as const,
  right: 8,
  top: 0,
  bottom: 0,
  width: 44,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
