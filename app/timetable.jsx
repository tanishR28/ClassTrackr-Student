import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getSubjectsWithStatsForDay,
  getSubjectsNotInDay,
  toggleTimetableSubject,
} from "../services/database";
import { showAlert } from "../components/CustomAlert";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const JS_DAY_TO_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Timetable() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(
    JS_DAY_TO_SHORT[new Date().getDay()]
  );
  const [daySubjects, setDaySubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [available, setAvailable] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const pickerSheetTranslateY = useRef(new Animated.Value(400)).current;

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubjectsWithStatsForDay(db, selectedDay);
      setDaySubjects(data);
    } catch {
      showAlert("Error", "Failed to load timetable.");
    } finally {
      setLoading(false);
    }
  }, [db, selectedDay]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const handleRemove = (subject) => {
    showAlert(
      "Remove from " + selectedDay,
      `Remove "${subject.name}" from ${selectedDay}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await toggleTimetableSubject(db, selectedDay, subject.id, false);
              await loadDay();
            } catch {
              showAlert("Error", "Failed to remove subject.");
            }
          },
        },
      ]
    );
  };

  const openPicker = async () => {
    setPickerLoading(true);
    setPickerMounted(true);
    Animated.parallel([
      Animated.timing(pickerBackdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(pickerSheetTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    try {
      const data = await getSubjectsNotInDay(db, selectedDay);
      setAvailable(data);
    } catch {
      showAlert("Error", "Failed to load subjects.");
    } finally {
      setPickerLoading(false);
    }
  };

  const closePicker = () => {
    Animated.parallel([
      Animated.timing(pickerBackdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(pickerSheetTranslateY, { toValue: 400, duration: 180, useNativeDriver: true }),
    ]).start(() => setPickerMounted(false));
  };

  const handleAdd = async (subject) => {
    try {
      await toggleTimetableSubject(db, selectedDay, subject.id, true);
      // Remove just this item from the picker list — keep modal open
      setAvailable((prev) => prev.filter((s) => s.id !== subject.id));
      // Refresh background list
      loadDay();
    } catch {
      showAlert("Error", "Failed to add subject.");
    }
  };

  const renderDaySubject = ({ item }) => (
    <View style={styles.subjectCard}>
      <View style={styles.subjectInfo}>
        <Text style={styles.subjectName}>{item.name}</Text>
        <View style={[styles.badge, item.type === "theory" ? styles.badgeTheory : styles.badgeLab]}>
          <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Timetable</Text>
        <View style={{ width: 60 }} />
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

      {/* Subject list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : daySubjects.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No subjects for {selectedDay}</Text>
          <Text style={styles.emptySubtitle}>Tap "+ Add Subject" to assign classes</Text>
        </View>
      ) : (
        <FlatList
          data={daySubjects}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDaySubject}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Add subject button */}
      <TouchableOpacity style={styles.addFab} onPress={openPicker}>
        <Text style={styles.addFabText}>+ Add Subject</Text>
      </TouchableOpacity>

      {/* Picker — animated overlay, no Modal */}
      {pickerMounted && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={closePicker}>
            <Animated.View style={[styles.pickerOverlay, { opacity: pickerBackdropOpacity }]} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: pickerSheetTranslateY }] }]}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add to {selectedDay}</Text>
              <TouchableOpacity onPress={closePicker}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {pickerLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#2196F3" />
              </View>
            ) : available.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.emptyText}>All subjects already added for {selectedDay}.</Text>
              </View>
            ) : (
              <FlatList
                data={available}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    onPress={() => handleAdd(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName}>{item.name}</Text>
                      <View style={[styles.badge, item.type === "theory" ? styles.badgeTheory : styles.badgeLab]}>
                        <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.addRowBtn}>+ Add</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    backgroundColor: "#2196F3",
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: "#fff", fontSize: 15, fontWeight: "500" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  dayRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexWrap: "wrap",
  },
  dayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  dayBtnActive: { backgroundColor: "#2196F3" },
  dayText: { fontSize: 13, fontWeight: "700", color: "#666" },
  dayTextActive: { color: "#fff" },
  list: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "bold", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: "#888", textAlign: "center" },
  subjectCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 15, fontWeight: "600", color: "#222", marginBottom: 4 },
  badge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTheory: { backgroundColor: "#E3F2FD" },
  badgeLab: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#555" },
  removeBtn: { padding: 6 },
  removeBtnText: { fontSize: 16, color: "#F44336", fontWeight: "bold" },
  addFab: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    backgroundColor: "#2196F3",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  addFabText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  pickerSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "58%",
    paddingTop: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pickerTitle: { fontSize: 16, fontWeight: "bold", color: "#222" },
  pickerClose: { fontSize: 18, color: "#888" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  addRowBtn: { color: "#2196F3", fontWeight: "700", fontSize: 14 },
  pickerEmpty: { padding: 32, alignItems: "center" },
  emptyText: { color: "#aaa", fontSize: 14, textAlign: "center" },
});
