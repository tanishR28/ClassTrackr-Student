import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { getAttendance, markAttendance } from "../../services/database";
import { formatDate } from "../../utils/dateUtils";
import { showAlert } from "../../components/CustomAlert";

export default function MarkAttendance() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { id, subjectName, sessionDate, sessionType, lectureNum } = useLocalSearchParams();
  const sessionId = Number(id);

  const [status, setStatus] = useState(null); // 'present' | 'absent' | null
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const record = await getAttendance(db, sessionId);
        if (record) setStatus(record.status);
      } catch (e) {
        showAlert("Error", "Failed to load attendance.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [db, sessionId]);

  const handleSave = async () => {
    if (!status) {
      showAlert("Select Status", "Please select Present or Absent before saving.");
      return;
    }
    setSaving(true);
    try {
      await markAttendance(db, sessionId, status);
      router.back();
    } catch (e) {
      showAlert("Error", "Failed to save attendance.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {subjectName}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <View style={styles.body}>
          {/* Session info */}
          <View style={styles.infoCard}>
            <InfoRow label="Subject" value={subjectName} />
            <InfoRow label="Session" value={`#${lectureNum}`} />
            <InfoRow label="Date" value={formatDate(sessionDate)} />
            <InfoRow
              label="Type"
              value={sessionType === "lab" ? "Lab" : "Lecture"}
            />
          </View>

          <Text style={styles.questionText}>Did you attend this class?</Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.choiceBtn,
                styles.presentBtn,
                status === "present" && styles.presentActive,
              ]}
              onPress={() => setStatus("present")}
              activeOpacity={0.8}
            >
              <Text style={styles.choiceIcon}>✓</Text>
              <Text
                style={[
                  styles.choiceLabel,
                  status === "present" && styles.choiceLabelActive,
                ]}
              >
                Present
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.choiceBtn,
                styles.absentBtn,
                status === "absent" && styles.absentActive,
              ]}
              onPress={() => setStatus("absent")}
              activeOpacity={0.8}
            >
              <Text style={styles.choiceIcon}>✗</Text>
              <Text
                style={[
                  styles.choiceLabel,
                  status === "absent" && styles.choiceLabelAbsentActive,
                ]}
              >
                Absent
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!status || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!status || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    backgroundColor: "#fff",
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  back: { color: "#2196F3", fontSize: 15 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "bold", color: "#222", marginHorizontal: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  body: { flex: 1, padding: 20 },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: { fontSize: 13, color: "#888" },
  infoValue: { fontSize: 13, fontWeight: "600", color: "#333" },
  questionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  toggleRow: { flexDirection: "row", gap: 14, marginBottom: 32 },
  choiceBtn: {
    flex: 1,
    paddingVertical: 24,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  presentBtn: { borderColor: "#e0e0e0" },
  presentActive: { borderColor: "#4CAF50", backgroundColor: "#E8F5E9" },
  absentBtn: { borderColor: "#e0e0e0" },
  absentActive: { borderColor: "#F44336", backgroundColor: "#FFEBEE" },
  choiceIcon: { fontSize: 30, marginBottom: 8, color: "#ccc" },
  choiceLabel: { fontSize: 15, fontWeight: "600", color: "#aaa" },
  choiceLabelActive: { color: "#4CAF50" },
  choiceLabelAbsentActive: { color: "#F44336" },
  saveBtn: {
    backgroundColor: "#2196F3",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
