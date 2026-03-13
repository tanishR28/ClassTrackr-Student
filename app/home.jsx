import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSubjectsWithStats, deleteSubject } from "../services/database";
import {
  calculateAttendancePercentage,
  getPercentageColor,
  calculateLecturesNeeded,
} from "../utils/attendanceUtils";
import { showAlert } from "../components/CustomAlert";

export default function Home() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSubjects = useCallback(async () => {
    try {
      const data = await getSubjectsWithStats(db);
      setSubjects(data);
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
            } catch (e) {
              showAlert("Error", "Failed to delete subject.");
            }
          },
        },
      ]
    );
  };

  const renderSubject = ({ item }) => {
    const present = item.present || 0;
    const total = item.total || 0;
    const pct = calculateAttendancePercentage(present, total);
    const color = getPercentageColor(pct);
    const needed = calculateLecturesNeeded(present, total);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({ pathname: "/subjects/[id]", params: { id: item.id, subjectName: item.name, subjectType: item.type } })
        }
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.subjectName}>{item.name}</Text>
            <View style={[styles.badge, item.type === "theory" ? styles.badgeTheory : styles.badgeLab]}>
              <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.pct, { color }]}>{pct}%</Text>
            <Text style={styles.fraction}>{present}/{total}</Text>
          </View>
        </View>

        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>

        {needed > 0 && total > 0 && (
          <Text style={styles.warning}>
            Need {needed} more class{needed !== 1 ? "es" : ""} to reach 75%
          </Text>
        )}

        <Text style={styles.hint}>Long press to delete  •  Tap to view sessions</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#2196F3" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>ClassTrackr</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/subjects/add")}
        >
          <Text style={styles.addBtnText}>+ Add Subject</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : subjects.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>No subjects yet</Text>
          <Text style={styles.emptySubtitle}>Tap "+ Add Subject" to get started</Text>
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
              onRefresh={() => {
                setRefreshing(true);
                loadSubjects();
              }}
              colors={["#2196F3"]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    backgroundColor: "#2196F3",
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  list: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },
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
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cardLeft: { flex: 1, marginRight: 10 },
  cardRight: { alignItems: "flex-end" },
  subjectName: { fontSize: 16, fontWeight: "bold", color: "#222", marginBottom: 6 },
  badge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTheory: { backgroundColor: "#E3F2FD" },
  badgeLab: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#555" },
  pct: { fontSize: 22, fontWeight: "bold" },
  fraction: { fontSize: 12, color: "#888", marginTop: 2 },
  barBg: { height: 8, backgroundColor: "#eee", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  barFill: { height: "100%", borderRadius: 4 },
  warning: { fontSize: 12, color: "#FF9800", marginBottom: 4 },
  hint: { fontSize: 11, color: "#bbb", marginTop: 4 },
});
