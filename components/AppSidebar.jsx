import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const SIDEBAR_WIDTH = 280;

export default function AppSidebar({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -SIDEBAR_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const navigate = (path) => {
    onClose();
    setTimeout(() => router.push(path), 180);
  };

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — fades in, no slide */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Sidebar panel */}
      <Animated.View
        style={[styles.sidebar, { paddingTop: insets.top, transform: [{ translateX }] }]}
      >
        {/* Compact top bar */}
        <View style={styles.topBar}>
          <Text style={styles.appName}>ClassTrackr</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.item}
          onPress={() => navigate('/timetable')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.icon}>📅</Text>
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Timetable</Text>
            <Text style={styles.itemSub}>Set subjects per day</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => navigate('/manage-subjects')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
            <Text style={styles.icon}>📚</Text>
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Manage Subjects</Text>
            <Text style={styles.itemSub}>All subjects & attendance</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => navigate('/pause')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.icon}>⏸️</Text>
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Pause Timetable</Text>
            <Text style={styles.itemSub}>Skip classes for a period</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Push About to bottom */}
        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={styles.aboutBtn}
          onPress={() => navigate('/about')}
          activeOpacity={0.7}
        >
          <Text style={styles.aboutIcon}>ℹ️</Text>
          <Text style={styles.aboutLabel}>About ClassTrackr</Text>
        </TouchableOpacity>
        <View style={{ height: insets.bottom + 12 }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  closeIcon: { fontSize: 18, color: '#aaa' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  itemText: { flex: 1 },
  itemLabel: { fontSize: 15, fontWeight: '600', color: '#222' },
  itemSub: { fontSize: 12, color: '#999', marginTop: 2 },
  chevron: { fontSize: 22, color: '#ddd', fontWeight: '300' },
  aboutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  aboutIcon: { fontSize: 18 },
  aboutLabel: { fontSize: 14, fontWeight: '600', color: '#888' },
});
