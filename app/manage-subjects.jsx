import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getSubjectsWithStats,
  createSubject,
  deleteSubject,
  getSubjectNames,
} from "../services/database";
import {
  calculateAttendancePercentage,
  getPercentageColor,
} from "../utils/attendanceUtils";
import { showAlert } from "../components/CustomAlert";

const TYPES = [
  { key: "theory", label: "Lecture Only", sub: "1 theory subject" },
  { key: "lab",    label: "Lab Only",     sub: "1 lab subject"    },
  { key: "both",   label: "Both",         sub: "Theory + Lab pair" },
];

export default function ManageSubjects() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [subjects, setSubjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add-sheet state
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName]       = useState("");
  const [typeKey, setTypeKey] = useState("theory");
  const [saving, setSaving]   = useState(false);

  const loadSubjects = useCallback(async () => {
    try {
      const data = await getSubjectsWithStats(db);
      setSubjects(data);
    } catch {
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

  const openAdd = () => {
    setName("");
    setTypeKey("theory");
    setShowAdd(true);
  };

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert("Validation", "Subject name is required.");
      return;
    }
    if (trimmed.length < 2) {
      showAlert("Validation", "Name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      const existing = await getSubjectNames(db);
      if (existing.includes(trimmed.toLowerCase())) {
        showAlert("Duplicate", `"${trimmed}" already exists.`);
        return;
      }
      if (typeKey === "both") {
        const labName = `${trimmed} Lab`;
        if (existing.includes(labName.toLowerCase())) {
          showAlert("Duplicate", `"${labName}" already exists.`);
          return;
        }
        await createSubject(db, trimmed, "theory");
        await createSubject(db, labName, "lab");
      } else {
        await createSubject(db, trimmed, typeKey);
      }
      setShowAdd(false);
      await loadSubjects();
    } catch {
      showAlert("Error", "Failed to create subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (subject) => {
    showAlert(
      "Delete Subject",
      `Delete "${subject.name}"? All sessions, attendance and timetable entries will be removed.`,
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

  // ── Render one subject row ──────────────────────────────────────────────
  const renderSubject = ({ item }) => {
    const present = item.present || 0;
    const total   = item.total   || 0;
    const pct     = calculateAttendancePercentage(present, total);
    const color   = getPercentageColor(pct);

    return (
      <View style={styles.card}>
        {/* Tappable area → sessions */}
        <TouchableOpacity
          style={styles.cardBody}
          onPress={() =>
            router.push({
              pathname: "/subjects/[id]",
              params: { id: item.id, subjectName: item.name, subjectType: item.type },
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.subjectName}>{item.name}</Text>
            <View style={[styles.badge, item.type === "theory" ? styles.badgeTheory : styles.badgeLab]}>
              <Text style={styles.badgeText}>
                {item.type === "theory" ? "LECTURE" : "LAB"}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.pct, { color }]}>{pct}%</Text>
            <Text style={styles.fraction}>{present}/{total}</Text>
          </View>
        </TouchableOpacity>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Screen ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Subjects</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Info bar */}
      {!loading && (
        <View style={styles.infoBar}>
          <Text style={styles.infoCount}>
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.infoHint}>Tap → sessions  •  🗑 → delete</Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : subjects.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>No subjects yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap "+ Add" to create your first subject.{"\n"}
            Start with theory subjects, then add labs.
          </Text>
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSubject}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadSubjects(); }}
              colors={["#2196F3"]}
            />
          }
        />
      )}

      {/* ── Add Subject bottom sheet ────────────────────────────────────── */}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdd(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Dim backdrop – tap to close */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShowAdd(false)}
          />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />

            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New Subject</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Text style={styles.fieldLabel}>Subject Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mathematics, Physics"
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />

              {/* Type selector */}
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {TYPES.map((t) => {
                  const active = typeKey === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.typeCard, active && styles.typeCardActive]}
                      onPress={() => setTypeKey(t.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                        {t.label}
                      </Text>
                      <Text style={[styles.typeSub, active && styles.typeSubActive]}>
                        {t.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Preview for "Both" */}
              {typeKey === "both" && name.trim().length > 0 && (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>Will create:</Text>
                  <Text style={styles.previewItem}>• {name.trim()}  (Theory)</Text>
                  <Text style={styles.previewItem}>• {name.trim()} Lab  (Lab)</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.submitDisabled]}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {typeKey === "both" ? "Create Both Subjects" : "Create Subject"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
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
  back: { color: "#fff", fontSize: 15, fontWeight: "500" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Info bar
  infoBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  infoCount: { fontSize: 13, fontWeight: "600", color: "#444" },
  infoHint:  { fontSize: 12, color: "#bbb" },

  // List
  list: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyIcon:     { fontSize: 52, marginBottom: 12 },
  emptyTitle:    { fontSize: 17, fontWeight: "bold", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 20 },

  // Subject card
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    overflow: "hidden",
  },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardLeft:  { flex: 1 },
  cardRight: { alignItems: "flex-end" },
  subjectName: { fontSize: 15, fontWeight: "bold", color: "#222", marginBottom: 5 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTheory: { backgroundColor: "#E3F2FD" },
  badgeLab:    { backgroundColor: "#FFF3E0" },
  badgeText:   { fontSize: 10, fontWeight: "700", color: "#555" },
  pct:      { fontSize: 20, fontWeight: "bold" },
  fraction: { fontSize: 11, color: "#999", marginTop: 2 },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    borderLeftWidth: 1,
    borderLeftColor: "#f0f0f0",
  },
  deleteIcon: { fontSize: 17 },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: "82%",
  },
  sheetHandle: {
    width: 40, height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  sheetTitle: { fontSize: 18, fontWeight: "bold", color: "#222" },
  sheetClose: { fontSize: 18, color: "#999" },

  // Form
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 22,
  },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  typeCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  typeCardActive:  { borderColor: "#2196F3", backgroundColor: "#E3F2FD" },
  typeLabel:       { fontSize: 12, fontWeight: "700", color: "#666", textAlign: "center" },
  typeLabelActive: { color: "#1565C0" },
  typeSub:         { fontSize: 10, color: "#aaa", marginTop: 3, textAlign: "center" },
  typeSubActive:   { color: "#42A5F5" },

  // Preview
  preview: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  previewTitle: { fontSize: 12, fontWeight: "700", color: "#388E3C", marginBottom: 4 },
  previewItem:  { fontSize: 13, color: "#2E7D32", marginTop: 3 },

  // Submit
  submitBtn: {
    backgroundColor: "#2196F3",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
