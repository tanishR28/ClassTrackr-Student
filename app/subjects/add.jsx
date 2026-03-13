import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { createSubject, getSubjectNames } from "../../services/database";
import { showAlert } from "../../components/CustomAlert";

export default function AddSubject() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [type, setType] = useState("theory");
  const [hasLab, setHasLab] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert("Validation", "Subject name is required.");
      return;
    }
    if (trimmed.length < 3) {
      showAlert("Validation", "Subject name must be at least 3 characters.");
      return;
    }

    setLoading(true);
    try {
      const existingNames = await getSubjectNames(db);

      if (existingNames.includes(trimmed.toLowerCase())) {
        showAlert("Duplicate", `"${trimmed}" already exists.`);
        setLoading(false);
        return;
      }

      if (type === "theory" && hasLab) {
        const labName = `${trimmed} Lab`;
        if (existingNames.includes(labName.toLowerCase())) {
          showAlert("Duplicate", `"${labName}" already exists.`);
          setLoading(false);
          return;
        }
        await createSubject(db, trimmed, "theory");
        await createSubject(db, labName, "lab");
        setSuccessMessage(`Created "${trimmed}" and "${labName}".`);
      } else {
        await createSubject(db, trimmed, type);
        setSuccessMessage(`Created "${trimmed}".`);
      }

      setShowSuccess(true);
    } catch (e) {
      showAlert("Error", "Failed to create subject.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Subject</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Subject Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mathematics, Physics"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, type === "theory" && styles.toggleActive]}
            onPress={() => setType("theory")}
          >
            <Text style={[styles.toggleText, type === "theory" && styles.toggleTextActive]}>
              Theory
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, type === "lab" && styles.toggleActive]}
            onPress={() => setType("lab")}
          >
            <Text style={[styles.toggleText, type === "lab" && styles.toggleTextActive]}>
              Lab
            </Text>
          </TouchableOpacity>
        </View>

        {type === "theory" && (
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setHasLab(!hasLab)}
          >
            <View style={[styles.checkbox, hasLab && styles.checkboxChecked]}>
              {hasLab && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>This subject also has a lab</Text>
          </TouchableOpacity>
        )}

        {type === "theory" && hasLab && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Two subjects will be created:{"\n"}
              • {name.trim() || "Subject"}{"\n"}
              • {name.trim() || "Subject"} Lab
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {type === "theory" && hasLab ? "Create Both Subjects" : "Create Subject"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>✔</Text>
            <Text style={styles.modalTitle}>Success!</Text>
            <Text style={styles.modalMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => {
                setShowSuccess(false);
                router.back();
              }}
            >
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    backgroundColor: "#fff",
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  cancel: { color: "#F44336", fontSize: 14 },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: "#222" },
  body: { padding: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  toggle: { flexDirection: "row", gap: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  toggleActive: { borderColor: "#2196F3", backgroundColor: "#E3F2FD" },
  toggleText: { fontSize: 14, color: "#888" },
  toggleTextActive: { color: "#2196F3", fontWeight: "700" },
  checkRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#2196F3", borderColor: "#2196F3" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  checkLabel: { fontSize: 14, color: "#333" },
  infoBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  infoText: { fontSize: 13, color: "#388E3C", lineHeight: 20 },
  submitBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 30,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    width: "100%",
  },
  modalIcon: { fontSize: 40, color: "#4CAF50", marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#222", marginBottom: 8 },
  modalMessage: { fontSize: 14, color: "#555", textAlign: "center", marginBottom: 20 },
  modalBtn: {
    backgroundColor: "#2196F3",
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
