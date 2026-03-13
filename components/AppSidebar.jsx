import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const SIDEBAR_WIDTH = 270;

export default function AppSidebar({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -SIDEBAR_WIDTH,
      duration: visible ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  const navigate = (path) => {
    onClose();
    setTimeout(() => router.push(path), 180);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX }], paddingTop: insets.top }]}
      >
        {/* Brand header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>ClassTrackr</Text>
            <Text style={styles.appSub}>Student Attendance</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Nav items */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigate('/timetable')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.menuIcon}>📅</Text>
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>Timetable</Text>
            <Text style={styles.menuSub}>Set subjects per day</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigate('/manage-subjects')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
            <Text style={styles.menuIcon}>📚</Text>
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>Manage Subjects</Text>
            <Text style={styles.menuSub}>All subjects & attendance</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigate('/pause')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.menuIcon}>⏸️</Text>
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>Pause Timetable</Text>
            <Text style={styles.menuSub}>Skip classes for a period</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sidebar: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 20,
    backgroundColor: '#2196F3',
  },
  appName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  appSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  closeBtn: { fontSize: 18, color: 'rgba(255,255,255,0.85)' },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
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
  menuIcon: { fontSize: 20 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#222' },
  menuSub: { fontSize: 12, color: '#999', marginTop: 2 },
  chevron: { fontSize: 20, color: '#ccc', fontWeight: '300' },
});
