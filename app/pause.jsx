import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getActivePause, setPause, clearPause } from "../services/database";
import { showAlert } from "../components/CustomAlert";

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${parseInt(dd, 10)} ${MONTH_NAMES[parseInt(mm, 10) - 1]} ${yyyy}`;
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

export default function PauseScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [activePause, setActivePause] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [endInput, setEndInput] = useState('');

  const load = useCallback(async () => {
    try {
      const pause = await getActivePause(db);
      setActivePause(pause ?? null);
    } catch {
      showAlert("Error", "Failed to load pause data.");
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const applyQuickEnd = (days) => {
    const end = addDays(startDate, days);
    setEndDate(end);
    setEndInput(end);
  };

  const handleEndInput = (text) => {
    setEndInput(text);
    if (isValidDate(text)) setEndDate(text);
    else setEndDate('');
  };

  const handleSave = async () => {
    if (!isValidDate(startDate)) {
      showAlert("Invalid Date", "Start date is invalid.");
      return;
    }
    if (!isValidDate(endDate)) {
      showAlert("Invalid Date", "Please select or enter a valid end date (YYYY-MM-DD).");
      return;
    }
    if (endDate < startDate) {
      showAlert("Invalid Range", "End date must be on or after start date.");
      return;
    }
    setSaving(true);
    try {
      await setPause(db, startDate, endDate);
      setActivePause({ start_date: startDate, end_date: endDate });
      setEndDate('');
      setEndInput('');
      showAlert("Pause Set", `Timetable paused from ${formatDate(startDate)} to ${formatDate(endDate)}. All classes in this period will be treated as cancelled.`);
    } catch {
      showAlert("Error", "Failed to save pause.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    showAlert(
      "Remove Pause",
      "Remove the active pause? Attendance tracking will resume normally.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await clearPause(db);
              setActivePause(null);
            } catch {
              showAlert("Error", "Failed to remove pause.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#2196F3" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pause Timetable</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Active pause banner */}
          {activePause ? (
            <View style={styles.activePauseCard}>
              <View style={styles.activePauseIcon}>
                <Text style={styles.pauseEmoji}>⏸️</Text>
              </View>
              <View style={styles.activePauseInfo}>
                <Text style={styles.activePauseTitle}>Timetable Paused</Text>
                <Text style={styles.activePauseDates}>
                  {formatDate(activePause.start_date)} → {formatDate(activePause.end_date)} (both inclusive)
                </Text>
                <Text style={styles.activePauseNote}>
                  All classes in this period are treated as cancelled.
                </Text>
              </View>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Text style={styles.clearBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noPauseCard}>
              <Text style={styles.noPauseText}>No active pause — tracking all scheduled days.</Text>
            </View>
          )}

          {/* Set new pause */}
          <Text style={styles.sectionTitle}>Set Pause Period</Text>
          <View style={styles.card}>

            {/* Start date row */}
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>From</Text>
              <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
            </View>

            {/* Quick end date */}
            <Text style={styles.fieldLabel}>Until (inclusive) — Quick Select</Text>
            <View style={styles.quickRow}>
              {[
                { label: '3 days', days: 3 },
                { label: '1 week', days: 7 },
                { label: '2 weeks', days: 14 },
                { label: '1 month', days: 30 },
              ].map(({ label, days }) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.quickBtn,
                    endDate === addDays(startDate, days) && styles.quickBtnActive,
                  ]}
                  onPress={() => applyQuickEnd(days)}
                >
                  <Text
                    style={[
                      styles.quickBtnText,
                      endDate === addDays(startDate, days) && styles.quickBtnTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom date input */}
            <Text style={styles.fieldLabel}>Or Enter End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.dateInput, !isValidDate(endInput) && endInput.length > 0 && styles.dateInputError]}
              value={endInput}
              onChangeText={handleEndInput}
              placeholder="e.g. 2026-04-01"
              placeholderTextColor="#bbb"
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="done"
            />
            {endDate && (
              <Text style={styles.selectedEnd}>
                Pause until: <Text style={styles.selectedEndBold}>{formatDate(endDate)}</Text> (inclusive)
              </Text>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, (!endDate || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!endDate || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Set Pause</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.infoText}>
            During the pause period (both start and end dates included), all scheduled and extra lectures will be automatically treated as cancelled — no attendance will be recorded.
          </Text>
        </ScrollView>
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
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" },
  headerSpacer: { width: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16 },

  // Active pause card
  activePauseCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  activePauseIcon: { alignItems: "center", justifyContent: "center" },
  pauseEmoji: { fontSize: 28 },
  activePauseInfo: { flex: 1 },
  activePauseTitle: { fontSize: 14, fontWeight: "700", color: "#E65100", marginBottom: 3 },
  activePauseDates: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 3 },
  activePauseNote: { fontSize: 12, color: "#888" },
  clearBtn: {
    backgroundColor: "#F44336",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  clearBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  noPauseCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  noPauseText: { fontSize: 13, color: "#388E3C", fontWeight: "600" },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#333", marginBottom: 10 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dateLabel: { fontSize: 13, color: "#888", fontWeight: "600" },
  dateValue: { fontSize: 15, fontWeight: "700", color: "#2196F3" },
  fieldLabel: { fontSize: 12, color: "#999", fontWeight: "600", marginBottom: 8, marginTop: 4 },
  quickRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  quickBtn: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickBtnActive: { borderColor: "#2196F3", backgroundColor: "#E3F2FD" },
  quickBtnText: { fontSize: 13, color: "#888", fontWeight: "600" },
  quickBtnTextActive: { color: "#2196F3" },
  dateInput: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#222",
    marginBottom: 8,
    fontFamily: "monospace",
  },
  dateInputError: { borderColor: "#F44336" },
  selectedEnd: { fontSize: 13, color: "#888", marginBottom: 16 },
  selectedEndBold: { fontWeight: "700", color: "#333" },
  saveBtn: {
    backgroundColor: "#2196F3",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: "#B0BEC5" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  infoText: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
});
