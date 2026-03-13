import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAttendanceCounter, upsertAttendanceCounter } from "../../services/database";
import {
  calculateAttendancePercentage,
  getPercentageColor,
  calculateLecturesNeeded,
} from "../../utils/attendanceUtils";
import { showAlert } from "../../components/CustomAlert";

export default function SubjectAttendance() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { id, subjectName, subjectType } = useLocalSearchParams();
  const subjectId = Number(id);

  const [total,     setTotal]     = useState(0);
  const [present,   setPresent]   = useState(0);
  const [threshold, setThreshold] = useState(75);
  const [loading,   setLoading]   = useState(true);

  // Which field is being typed: 'total' | 'present' | 'threshold' | null
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const row = await getAttendanceCounter(db, subjectId);
        setTotal(row.total);
        setPresent(row.present);
        setThreshold(row.threshold ?? 75);
      } catch {
        showAlert("Error", "Failed to load attendance.");
      } finally {
        setLoading(false);
      }
    })();
  }, [db, subjectId]);

  const save = useCallback(async (t, p, th) => {
    try {
      await upsertAttendanceCounter(db, subjectId, t, p, th);
    } catch {
      showAlert("Error", "Failed to save.");
    }
  }, [db, subjectId]);

  // ── Stepper handlers ───────────────────────────────────────────────────────
  const changeTotal = (delta) => {
    setTotal((prev) => {
      const next = Math.max(present, prev + delta);
      save(next, present, threshold);
      return next;
    });
  };

  const changePresent = (delta) => {
    setPresent((prev) => {
      const next = Math.min(total, Math.max(0, prev + delta));
      save(total, next, threshold);
      return next;
    });
  };

  const changeThreshold = (delta) => {
    setThreshold((prev) => {
      const next = Math.min(100, Math.max(1, prev + delta));
      save(total, present, next);
      return next;
    });
  };

  // ── Tap-to-edit handlers ───────────────────────────────────────────────────
  const startEdit = (field, currentValue) => {
    setEditingField(field);
    setEditingValue(String(currentValue));
  };

  const commitEdit = () => {
    const raw = parseInt(editingValue, 10);
    if (isNaN(raw) || raw < 0) {
      setEditingField(null);
      return;
    }

    let newTotal = total;
    let newPresent = present;
    let newThreshold = threshold;

    if (editingField === "total") {
      // Can't drop total below present
      newTotal = Math.max(present, raw);
      setTotal(newTotal);
    } else if (editingField === "present") {
      newPresent = Math.max(0, raw);
      // If attended > total, auto-expand total
      if (newPresent > total) {
        newTotal = newPresent;
        setTotal(newTotal);
      }
      setPresent(newPresent);
    } else if (editingField === "threshold") {
      newThreshold = Math.min(100, Math.max(1, raw));
      setThreshold(newThreshold);
    }

    setEditingField(null);
    save(newTotal, newPresent, newThreshold);
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const pct    = calculateAttendancePercentage(present, total);
  const color  = getPercentageColor(pct, threshold);
  const needed = calculateLecturesNeeded(present, total, threshold);
  const safe   = total > 0 && pct >= threshold;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
          <View style={[styles.typeBadge, subjectType === "lab" ? styles.badgeLab : styles.badgeTheory]}>
            <Text style={styles.typeBadgeText}>
              {subjectType === "lab" ? "LAB" : "LECTURE"}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Summary card ─────────────────────────────────────────── */}
            <View style={styles.summaryCard}>
              <Text style={[styles.pctText, { color }]}>{pct}%</Text>
              <Text style={styles.fractionText}>{present} / {total} classes attended</Text>

              {/* Progress bar with dynamic threshold marker */}
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                <View style={[styles.marker, { left: `${threshold}%` }]} />
              </View>
              <Text style={styles.markerLabel}>{threshold}% threshold</Text>

              {total === 0 ? (
                <Text style={styles.statusNeutral}>Use the counters below to track attendance</Text>
              ) : safe ? (
                <Text style={styles.statusSafe}>✓ You're above {threshold}% — keep it up!</Text>
              ) : (
                <Text style={styles.statusWarn}>
                  Need {needed} more class{needed !== 1 ? "es" : ""} to reach {threshold}%
                </Text>
              )}
            </View>

            {/* ── Total Classes ─────────────────────────────────────────── */}
            <CounterRow
              label="Total Classes"
              sub="Classes held so far"
              value={total}
              editing={editingField === "total"}
              editValue={editingValue}
              onValueTap={() => startEdit("total", total)}
              onEditChange={setEditingValue}
              onEditSubmit={commitEdit}
              onEditBlur={commitEdit}
              onDecrement={() => changeTotal(-1)}
              onIncrement={() => changeTotal(+1)}
              decrementDisabled={total <= present}
            />

            {/* ── Classes Attended ──────────────────────────────────────── */}
            <CounterRow
              label="Classes Attended"
              sub="Times you were present"
              value={present}
              editing={editingField === "present"}
              editValue={editingValue}
              onValueTap={() => startEdit("present", present)}
              onEditChange={setEditingValue}
              onEditSubmit={commitEdit}
              onEditBlur={commitEdit}
              onDecrement={() => changePresent(-1)}
              onIncrement={() => changePresent(+1)}
              decrementDisabled={present <= 0}
              incrementDisabled={present >= total}
              accentColor="#4CAF50"
            />

            {/* ── Required Threshold ────────────────────────────────────── */}
            <CounterRow
              label="Required Threshold"
              sub="Minimum attendance percentage"
              value={threshold}
              suffix="%"
              editing={editingField === "threshold"}
              editValue={editingValue}
              onValueTap={() => startEdit("threshold", threshold)}
              onEditChange={setEditingValue}
              onEditSubmit={commitEdit}
              onEditBlur={commitEdit}
              onDecrement={() => changeThreshold(-5)}
              onIncrement={() => changeThreshold(+5)}
              decrementDisabled={threshold <= 1}
              incrementDisabled={threshold >= 100}
              accentColor="#FF9800"
              stepLabel="±5"
            />
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── CounterRow ────────────────────────────────────────────────────────────────
function CounterRow({
  label, sub, value, suffix = "",
  editing, editValue, onValueTap, onEditChange, onEditSubmit, onEditBlur,
  onDecrement, onIncrement,
  decrementDisabled, incrementDisabled,
  accentColor = "#2196F3",
  stepLabel,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <View style={styles.counterCard}>
      <View style={styles.counterInfo}>
        <Text style={styles.counterLabel}>{label}</Text>
        <Text style={styles.counterSub}>{sub}</Text>
        {stepLabel && <Text style={[styles.stepHint, { color: accentColor }]}>Steps of 5</Text>}
      </View>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={[styles.counterBtn, { backgroundColor: accentColor }, decrementDisabled && styles.counterBtnDisabled]}
          onPress={onDecrement}
          disabled={decrementDisabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.counterBtnText, decrementDisabled && styles.counterBtnTextDisabled]}>−</Text>
        </TouchableOpacity>

        {editing ? (
          <TextInput
            ref={inputRef}
            style={styles.counterInput}
            value={editValue}
            onChangeText={onEditChange}
            onSubmitEditing={onEditSubmit}
            onBlur={onEditBlur}
            keyboardType="number-pad"
            selectTextOnFocus
            maxLength={4}
          />
        ) : (
          <TouchableOpacity onPress={onValueTap} activeOpacity={0.6}>
            <Text style={styles.counterValue}>{value}{suffix}</Text>
            <Text style={styles.tapHint}>tap to edit</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.counterBtn, { backgroundColor: accentColor }, incrementDisabled && styles.counterBtnDisabled]}
          onPress={onIncrement}
          disabled={incrementDisabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.counterBtnText, incrementDisabled && styles.counterBtnTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  back:          { color: "#fff", fontSize: 15, fontWeight: "500" },
  headerTitle:   { flex: 1, color: "#fff", fontSize: 17, fontWeight: "bold", marginHorizontal: 12 },
  typeBadge:     { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTheory:   { backgroundColor: "rgba(255,255,255,0.25)" },
  badgeLab:      { backgroundColor: "rgba(255,220,100,0.35)" },
  typeBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  body:   { padding: 20, paddingBottom: 40 },

  // Summary card
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  pctText:       { fontSize: 58, fontWeight: "bold", marginBottom: 4 },
  fractionText:  { fontSize: 14, color: "#666", marginBottom: 18 },
  barBg: {
    width: "100%",
    height: 10,
    backgroundColor: "#eee",
    borderRadius: 5,
    overflow: "visible",
    marginBottom: 4,
    position: "relative",
  },
  barFill:   { height: "100%", borderRadius: 5 },
  marker: {
    position: "absolute",
    top: -5, bottom: -5,
    width: 2,
    backgroundColor: "#FF9800",
    borderRadius: 1,
  },
  markerLabel:   { fontSize: 11, color: "#FF9800", marginBottom: 14, alignSelf: "flex-end" },
  statusSafe:    { fontSize: 13, color: "#4CAF50", fontWeight: "600" },
  statusWarn:    { fontSize: 13, color: "#F44336", fontWeight: "600" },
  statusNeutral: { fontSize: 13, color: "#999" },

  // Counter card
  counterCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  counterInfo:     { flex: 1 },
  counterLabel:    { fontSize: 15, fontWeight: "700", color: "#222" },
  counterSub:      { fontSize: 12, color: "#aaa", marginTop: 2 },
  stepHint:        { fontSize: 11, marginTop: 3, fontWeight: "600" },
  counterControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  counterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnDisabled:     { backgroundColor: "#e0e0e0" },
  counterBtnText:         { color: "#fff", fontSize: 22, fontWeight: "300", lineHeight: 26 },
  counterBtnTextDisabled: { color: "#bbb" },
  counterValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#222",
    minWidth: 44,
    textAlign: "center",
  },
  tapHint: {
    fontSize: 9,
    color: "#bbb",
    textAlign: "center",
    marginTop: 1,
  },
  counterInput: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#222",
    minWidth: 60,
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#2196F3",
    paddingVertical: 0,
  },
});
