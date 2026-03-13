import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getSubjectsWithStatsForDay,
  deleteSubject,
  initTodayMarks,
  processPendingMarks,
  setDailyMark,
  getTodayMarksMap,
  getAllSubjects,
  addExtraLecture,
  removeExtraLecture,
  getExtraLecturesForDate,
  setExtraLectureMark,
} from "../services/database";
import {
  calculateAttendancePercentage,
  getPercentageColor,
  calculateLecturesNeeded,
} from "../utils/attendanceUtils";
import { showAlert } from "../components/CustomAlert";
import AppSidebar from "../components/AppSidebar";

const JS_DAY_TO_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getTodayInfo() {
  const d = new Date();
  const dayIndex = d.getDay();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    short: JS_DAY_TO_SHORT[dayIndex],
    date: `${yyyy}-${mm}-${dd}`,
    label: `${DAY_NAMES[dayIndex]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${yyyy}`,
  };
}

const STATUS_LABEL = { present: 'Present', absent: 'Absent', skip: 'Cancelled' };
const STATUS_COLOR = { present: '#4CAF50', absent: '#F44336', skip: '#9E9E9E' };

export default function Home() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [today, setToday] = useState(() => getTodayInfo());

  const [subjects, setSubjects] = useState([]);
  const [marks, setMarks] = useState({});
  const [extraLectures, setExtraLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Extra lecture picker modal
  const [extraModalMounted, setExtraModalMounted] = useState(false);
  const [allSubjects, setAllSubjects] = useState([]);
  const extraBackdropOpacity = useRef(new Animated.Value(0)).current;
  const extraSheetTranslateY = useRef(new Animated.Value(400)).current;

  const loadSubjects = useCallback(async () => {
    const t = getTodayInfo(); // always fresh — correct even if midnight passed
    try {
      await processPendingMarks(db, t.date);
      await initTodayMarks(db, t.short, t.date);
      const [data, marksMap, extras] = await Promise.all([
        getSubjectsWithStatsForDay(db, t.short),
        getTodayMarksMap(db, t.date),
        getExtraLecturesForDate(db, t.date),
      ]);
      setToday(t);
      setSubjects(data);
      setMarks(marksMap);
      setExtraLectures(extras);
    } catch (e) {
      showAlert("Error", "Failed to load subjects.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSubjects();
    }, [loadSubjects])
  );

  // Fire at midnight so attendance updates the moment the new day starts,
  // even if the app is left open overnight. Recurses for subsequent nights.
  useEffect(() => {
    let timer;
    function scheduleMidnight() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(() => {
        setLoading(true);
        loadSubjects();
        scheduleMidnight(); // reschedule for the next midnight
      }, midnight.getTime() - now.getTime());
    }
    scheduleMidnight();
    return () => clearTimeout(timer);
  }, [loadSubjects]);

  // ── Mark all ────────────────────────────────────────────────────────────────

  const markAll = useCallback(async (status) => {
    if (subjects.length === 0) return;
    const allAlready = subjects.every((s) => (marks[s.id] ?? 'present') === status);
    const targetStatus = allAlready ? 'present' : status;
    const next = {};
    subjects.forEach((s) => { next[s.id] = targetStatus; });
    setMarks((prev) => ({ ...prev, ...next }));
    try {
      await Promise.all(subjects.map((s) => setDailyMark(db, today.date, s.id, targetStatus)));
    } catch {
      showAlert("Error", "Failed to update marks.");
      loadSubjects();
    }
  }, [db, today.date, subjects, marks]);

  // ── Timetable mark ──────────────────────────────────────────────────────────

  const handleMark = useCallback(async (subjectId, tappedStatus) => {
    const current = marks[subjectId] ?? 'present';
    const next = current === tappedStatus ? 'present' : tappedStatus;
    setMarks((prev) => ({ ...prev, [subjectId]: next }));
    try {
      await setDailyMark(db, today.date, subjectId, next);
    } catch {
      setMarks((prev) => ({ ...prev, [subjectId]: current }));
      showAlert("Error", "Failed to save mark.");
    }
  }, [db, today.date, marks]);

  // ── Extra lecture mark ──────────────────────────────────────────────────────

  const handleExtraMark = useCallback(async (subjectId, tappedStatus) => {
    const current = extraLectures.find((e) => e.subject_id === subjectId)?.status ?? 'present';
    const next = current === tappedStatus ? 'present' : tappedStatus;
    setExtraLectures((prev) =>
      prev.map((e) => (e.subject_id === subjectId ? { ...e, status: next } : e))
    );
    try {
      await setExtraLectureMark(db, today.date, subjectId, next);
    } catch {
      setExtraLectures((prev) =>
        prev.map((e) => (e.subject_id === subjectId ? { ...e, status: current } : e))
      );
      showAlert("Error", "Failed to save mark.");
    }
  }, [db, today.date, extraLectures]);

  const handleRemoveExtra = useCallback((item) => {
    showAlert(
      "Remove Extra Lecture",
      `Remove extra lecture for "${item.name}"? It won't be counted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeExtraLecture(db, today.date, item.subject_id);
              setExtraLectures((prev) =>
                prev.filter((e) => e.subject_id !== item.subject_id)
              );
            } catch {
              showAlert("Error", "Failed to remove extra lecture.");
            }
          },
        },
      ]
    );
  }, [db, today.date]);

  // ── Delete subject ──────────────────────────────────────────────────────────

  const handleDelete = (subject) => {
    showAlert(
      "Delete Subject",
      `Delete "${subject.name}"? All sessions and attendance data will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSubject(db, subject.id);
              await loadSubjects();
            } catch {
              showAlert("Error", "Failed to delete subject.");
            }
          },
        },
      ]
    );
  };

  // ── Extra lecture picker ────────────────────────────────────────────────────

  const openExtraModal = async () => {
    try {
      const all = await getAllSubjects(db);
      setAllSubjects(all);
      setExtraModalMounted(true);
      Animated.parallel([
        Animated.timing(extraBackdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(extraSheetTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } catch {
      showAlert("Error", "Failed to load subjects.");
    }
  };

  const closeExtraModal = () => {
    Animated.parallel([
      Animated.timing(extraBackdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(extraSheetTranslateY, { toValue: 400, duration: 180, useNativeDriver: true }),
    ]).start(() => setExtraModalMounted(false));
  };

  const handleAddExtra = async (subject) => {
    try {
      await addExtraLecture(db, today.date, subject.id);
      closeExtraModal();
      const extras = await getExtraLecturesForDate(db, today.date);
      setExtraLectures(extras);
    } catch {
      showAlert("Error", "Failed to add extra lecture.");
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderActionButtons = (status, onMarkAbsent, onMarkSkip) => (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.actionBtn, status === 'absent' && styles.actionBtnAbsent]}
        onPress={onMarkAbsent}
      >
        <Text style={[styles.actionBtnText, status === 'absent' && styles.actionBtnTextAbsent]}>
          {status === 'absent' ? '✓ Absent' : 'Absent'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, status === 'skip' && styles.actionBtnSkip]}
        onPress={onMarkSkip}
      >
        <Text style={[styles.actionBtnText, status === 'skip' && styles.actionBtnTextSkip]}>
          {status === 'skip' ? '✓ Cancelled' : 'Cancelled'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSubject = ({ item }) => {
    const present = item.present || 0;
    const total = item.total || 0;
    const pct = calculateAttendancePercentage(present, total);
    const color = getPercentageColor(pct);
    const needed = calculateLecturesNeeded(present, total);
    const status = marks[item.id] ?? 'present';

    return (
      <TouchableOpacity
        style={[styles.card, status === 'skip' && styles.cardSkip]}
        onPress={() =>
          router.push({
            pathname: "/subjects/[id]",
            params: { id: item.id, subjectName: item.name, subjectType: item.type },
          })
        }
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={[styles.subjectName, status === 'skip' && styles.textMuted]}>
              {item.name}
            </Text>
            <View style={[styles.badge, item.type === "theory" ? styles.badgeTheory : styles.badgeLab]}>
              <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.statusChip, { backgroundColor: STATUS_COLOR[status] + '22' }]}>
              <Text style={[styles.statusChipText, { color: STATUS_COLOR[status] }]}>
                {STATUS_LABEL[status]}
              </Text>
            </View>
            <Text style={[styles.pct, { color }, status === 'skip' && styles.textMuted]}>
              {pct}%
            </Text>
            <Text style={styles.fraction}>{present}/{total}</Text>
          </View>
        </View>

        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>

        {needed > 0 && total > 0 && status !== 'skip' && (
          <Text style={styles.warning}>
            Need {needed} more class{needed !== 1 ? "es" : ""} to reach 75%
          </Text>
        )}

        {renderActionButtons(
          status,
          () => handleMark(item.id, 'absent'),
          () => handleMark(item.id, 'skip'),
        )}

        <Text style={styles.hint}>Long press to delete  •  Tap to view details</Text>
      </TouchableOpacity>
    );
  };

  const renderExtraLecture = (item) => {
    const present = item.present || 0;
    const total = item.total || 0;
    const pct = calculateAttendancePercentage(present, total);
    const color = getPercentageColor(pct);
    const { status } = item;

    return (
      <TouchableOpacity
        key={`extra-${item.subject_id}`}
        style={[styles.card, styles.cardExtra, status === 'skip' && styles.cardSkip]}
        onPress={() =>
          router.push({
            pathname: "/subjects/[id]",
            params: { id: item.subject_id, subjectName: item.name, subjectType: item.type },
          })
        }
        onLongPress={() => handleRemoveExtra(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={[styles.subjectName, status === 'skip' && styles.textMuted]}>
              {item.name}
            </Text>
            <View style={styles.extraBadgeRow}>
              <View style={[styles.badge, item.type === "theory" ? styles.badgeTheory : styles.badgeLab]}>
                <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
              </View>
              <View style={styles.badgeExtra}>
                <Text style={styles.badgeExtraText}>EXTRA</Text>
              </View>
            </View>
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.statusChip, { backgroundColor: STATUS_COLOR[status] + '22' }]}>
              <Text style={[styles.statusChipText, { color: STATUS_COLOR[status] }]}>
                {STATUS_LABEL[status]}
              </Text>
            </View>
            <Text style={[styles.pct, { color }, status === 'skip' && styles.textMuted]}>
              {pct}%
            </Text>
            <Text style={styles.fraction}>{present}/{total}</Text>
          </View>
        </View>

        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>

        {renderActionButtons(
          status,
          () => handleExtraMark(item.subject_id, 'absent'),
          () => handleExtraMark(item.subject_id, 'skip'),
        )}

        <Text style={styles.hint}>Long press to remove  •  Tap to view details</Text>
      </TouchableOpacity>
    );
  };

  const extraSubjectIds = useMemo(
    () => new Set(extraLectures.map((e) => e.subject_id)),
    [extraLectures]
  );

  const ListFooter = () => {
    if (extraLectures.length === 0) return null;
    return (
      <View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Extra Lectures Today</Text>
        </View>
        {extraLectures.map(renderExtraLecture)}
      </View>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#2196F3" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setSidebarOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>ClassTrackr</Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* Today banner */}
      <View style={styles.todayBanner}>
        <View style={styles.todayLeft}>
          <Text style={styles.todayDate}>{today.label}</Text>
          <Text style={styles.todayCount}>
            {loading
              ? "Loading…"
              : subjects.length === 0
              ? "No classes scheduled"
              : `${subjects.length} class${subjects.length !== 1 ? "es" : ""} today`}
          </Text>
        </View>
        <View style={styles.todayRight}>
          {!loading && subjects.length > 0 && (
            <View style={styles.markAllRow}>
              <TouchableOpacity
                style={styles.markAllAbsent}
                onPress={() => markAll('absent')}
              >
                <Text style={styles.markAllAbsentText}>Absent All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.markAllCancel}
                onPress={() => markAll('skip')}
              >
                <Text style={styles.markAllCancelText}>Cancel All</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.timetableBtn}
            onPress={() => router.push("/timetable")}
          >
            <Text style={styles.timetableBtnText}>Edit Timetable</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : subjects.length === 0 && extraLectures.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No classes today</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Edit Timetable" to set up {today.short}'s schedule
          </Text>
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => `subj-${item.id}`}
          renderItem={renderSubject}
          contentContainerStyle={styles.list}
          ListFooterComponent={<ListFooter />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadSubjects();
              }}
              colors={["#2196F3"]}
            />
          }
        />
      )}

      {/* Extra Lecture button — always visible at bottom */}
      {!loading && (
        <TouchableOpacity style={styles.extraLectureBtn} onPress={openExtraModal}>
          <Text style={styles.extraLectureBtnText}>+ Extra Lecture</Text>
        </TouchableOpacity>
      )}

      {/* Extra Lecture Picker — animated overlay, no Modal */}
      {extraModalMounted && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={closeExtraModal}>
            <Animated.View style={[styles.modalBackdrop, { opacity: extraBackdropOpacity }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: extraSheetTranslateY }] }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Extra Lecture</Text>
              <TouchableOpacity onPress={closeExtraModal} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {allSubjects.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No subjects found. Add subjects first.</Text>
              </View>
            ) : (
              <ScrollView>
                {allSubjects.map((s) => {
                  const alreadyAdded = extraSubjectIds.has(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.pickerRow, alreadyAdded && styles.pickerRowDone]}
                      onPress={() => !alreadyAdded && handleAddExtra(s)}
                      activeOpacity={alreadyAdded ? 1 : 0.7}
                    >
                      <View style={styles.pickerRowLeft}>
                        <Text style={[styles.pickerName, alreadyAdded && styles.textMuted]}>
                          {s.name}
                        </Text>
                        <View style={[styles.badge, s.type === "theory" ? styles.badgeTheory : styles.badgeLab]}>
                          <Text style={styles.badgeText}>{s.type.toUpperCase()}</Text>
                        </View>
                      </View>
                      {alreadyAdded && (
                        <Text style={styles.pickerAdded}>Added ✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      )}

      <AppSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },

  // Header
  header: {
    backgroundColor: "#2196F3",
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBtn: { width: 36, gap: 5, justifyContent: "center" },
  menuLine: { height: 2.5, backgroundColor: "#fff", borderRadius: 2 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  headerSpacer: { width: 36 },

  // Today banner
  todayBanner: {
    backgroundColor: "#1976D2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  todayLeft: { flex: 1 },
  todayDate: { color: "#fff", fontSize: 14, fontWeight: "700" },
  todayCount: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  todayRight: { alignItems: "flex-end", gap: 6 },
  markAllRow: { flexDirection: "row", gap: 6 },
  markAllAbsent: {
    backgroundColor: "rgba(244,67,54,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  markAllAbsentText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  markAllCancel: {
    backgroundColor: "rgba(120,120,120,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  markAllCancelText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  timetableBtn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timetableBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // List
  list: { padding: 16, paddingBottom: 80 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },

  // Section header
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
    marginTop: 4,
  },
  sectionHeaderText: { fontSize: 13, fontWeight: "700", color: "#888", letterSpacing: 0.5 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardExtra: {
    borderLeftWidth: 3,
    borderLeftColor: "#FF9800",
  },
  cardSkip: { opacity: 0.55 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cardLeft: { flex: 1, marginRight: 10 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  subjectName: { fontSize: 16, fontWeight: "bold", color: "#222", marginBottom: 6 },
  textMuted: { color: "#aaa" },
  extraBadgeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  badge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTheory: { backgroundColor: "#E3F2FD" },
  badgeLab: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#555" },
  badgeExtra: { backgroundColor: "#FFF3E0", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeExtraText: { fontSize: 11, fontWeight: "700", color: "#E65100" },
  statusChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  pct: { fontSize: 22, fontWeight: "bold" },
  fraction: { fontSize: 12, color: "#888", marginTop: 2 },
  barBg: { height: 8, backgroundColor: "#eee", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  barFill: { height: "100%", borderRadius: 4 },
  warning: { fontSize: 12, color: "#FF9800", marginBottom: 4 },

  // Action buttons on card
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 4 },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ddd",
    alignItems: "center",
  },
  actionBtnAbsent: { borderColor: "#F44336", backgroundColor: "#FFF5F5" },
  actionBtnSkip: { borderColor: "#9E9E9E", backgroundColor: "#F5F5F5" },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: "#aaa" },
  actionBtnTextAbsent: { color: "#F44336" },
  actionBtnTextSkip: { color: "#757575" },
  hint: { fontSize: 11, color: "#bbb", marginTop: 4 },

  // Extra lecture bottom button
  extraLectureBtn: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    backgroundColor: "#FF9800",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  extraLectureBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Extra lecture modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#222" },
  modalClose: { padding: 4 },
  modalCloseText: { fontSize: 18, color: "#888" },
  modalEmpty: { padding: 32, alignItems: "center" },
  modalEmptyText: { color: "#888", fontSize: 14 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  pickerRowDone: { backgroundColor: "#fafafa" },
  pickerRowLeft: { gap: 6 },
  pickerName: { fontSize: 15, fontWeight: "600", color: "#222" },
  pickerAdded: { fontSize: 12, color: "#4CAF50", fontWeight: "700" },
});
