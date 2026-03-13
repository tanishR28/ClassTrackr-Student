import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSubjectsWithStats,
  getTimetableSubjectIds,
  toggleTimetableSubject,
} from '../services/database';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const JS_DAY_TO_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.82;

export default function TimetableSidebar({ visible, onClose, db, onChanged }) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [selectedDay, setSelectedDay] = useState(
    JS_DAY_TO_SHORT[new Date().getDay()]
  );
  const [subjects, setSubjects] = useState([]);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: -SIDEBAR_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateX]);

  const loadData = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [allSubjects, ids] = await Promise.all([
        getSubjectsWithStats(db),
        getTimetableSubjectIds(db, selectedDay),
      ]);
      setSubjects(allSubjects);
      setCheckedIds(new Set(ids));
    } finally {
      setLoading(false);
    }
  }, [db, selectedDay]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  const handleToggle = async (subjectId) => {
    const adding = !checkedIds.has(subjectId);
    const next = new Set(checkedIds);
    if (adding) next.add(subjectId);
    else next.delete(subjectId);
    setCheckedIds(next);
    try {
      await toggleTimetableSubject(db, selectedDay, subjectId, adding);
      if (onChanged) onChanged();
    } catch {
      setCheckedIds(checkedIds);
    }
  };

  const renderSubject = ({ item }) => {
    const checked = checkedIds.has(item.id);
    return (
      <TouchableOpacity
        style={styles.subjectRow}
        onPress={() => handleToggle(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.subjectName}>{item.name}</Text>
          <Text style={styles.subjectType}>
            {item.type === 'lab' ? 'Lab' : 'Theory'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX }], paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Timetable</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Day tabs */}
        <View style={styles.dayRow}>
          {DAYS.map((day) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayBtn, selectedDay === day && styles.dayBtnActive]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          Subjects for {selectedDay}
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#2196F3" />
          </View>
        ) : subjects.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No subjects added yet.</Text>
            <Text style={styles.emptyHint}>Go back and add subjects first.</Text>
          </View>
        ) : (
          <FlatList
            data={subjects}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderSubject}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebar: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  closeBtn: { fontSize: 18, color: '#888' },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  dayBtnActive: { backgroundColor: '#2196F3' },
  dayText: { fontSize: 13, fontWeight: '700', color: '#666' },
  dayTextActive: { color: '#fff' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#aaa', fontSize: 14, marginBottom: 6 },
  emptyHint: { color: '#ccc', fontSize: 12, textAlign: 'center' },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  subjectName: { fontSize: 15, fontWeight: '600', color: '#222' },
  subjectType: { fontSize: 12, color: '#888', marginTop: 1 },
});
