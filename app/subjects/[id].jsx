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
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import {
  getSessionsWithAttendance,
  createSession,
  deleteSession,
  getSubjectStats,
} from "../../services/database";
import { formatDate } from "../../utils/dateUtils";
import {
  calculateAttendancePercentage,
  getPercentageColor,
} from "../../utils/attendanceUtils";
import { showAlert } from "../../components/CustomAlert";

export default function SubjectSessions() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { id, subjectName, subjectType } = useLocalSearchParams();
  const subjectId = Number(id);

  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ present: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, s] = await Promise.all([
        getSessionsWithAttendance(db, subjectId),
        getSubjectStats(db, subjectId),
      ]);
      setSessions(rows);
      setStats({ present: s?.present || 0, total: s?.total || 0 });
    } catch (e) {
      showAlert("Error", "Failed to load sessions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, subjectId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const handleAddSession = async () => {
    const date = new Date().toISOString();
    const sessionType = subjectType === "lab" ? "lab" : "lecture";
    try {
      const newId = await createSession(db, subjectId, date, sessionType);
      // Navigate straight to mark attendance for the new session
      router.push({
        pathname: "/sessions/[id]",
        params: {
          id: newId,
          subjectName,
          sessionDate: date,
          sessionType,
          lectureNum: sessions.length + 1,
        },
      });
    } catch (e) {
      showAlert("Error", "Failed to create session.");
    }
  };

  const handleDelete = (session) => {
    showAlert(
      "Delete Session",
      `Delete session #${session.lectureNum}? Attendance data will also be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSession(db, session.id);
              await load();
            } catch (e) {
              showAlert("Error", "Failed to delete session.");
            }
          },
        },
      ]
    );
  };

  const pct = calculateAttendancePercentage(stats.present, stats.total);
  const color = getPercentageColor(pct);

  const renderSession = ({ item }) => {
    const statusColor =
      item.status === "present"
        ? "#4CAF50"
        : item.status === "absent"
        ? "#F44336"
        : "#9E9E9E";
    const statusLabel =
      item.status === "present"
        ? "PRESENT"
        : item.status === "absent"
        ? "ABSENT"
        : "NOT MARKED";

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() =>
          router.push({
            pathname: "/sessions/[id]",
            params: {
              id: item.id,
              subjectName,
              sessionDate: item.date,
              sessionType: item.session_type,
              lectureNum: item.lectureNum,
            },
          })
        }
        activeOpacity={0.8}
      >
        <View style={styles.sessionLeft}>
          <Text style={styles.lectureNum}>#{item.lectureNum}</Text>
          <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
          <Text style={styles.sessionType}>
            {item.session_type === "lab" ? "Lab" : "Lecture"}
          </Text>
        </View>
        <View style={styles.sessionRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteIcon}>🗑</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const sessionsWithNum = sessions.map((s, i) => ({ ...s, lectureNum: i + 1 }));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {subjectName}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddSession}>
          <Text style={styles.addBtnText}>+ Session</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {stats.present}/{stats.total} present
        </Text>
        <Text style={[styles.statsPct, { color }]}>{pct}%</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySubtitle}>Tap "+ Session" to add today's class</Text>
        </View>
      ) : (
        <FlatList
          data={sessionsWithNum}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
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
  addBtn: {
    backgroundColor: "#2196F3",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  statsText: { fontSize: 14, color: "#555" },
  statsPct: { fontSize: 18, fontWeight: "bold" },
  list: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "bold", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: "#888", textAlign: "center" },
  sessionCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  sessionLeft: {},
  lectureNum: { fontSize: 16, fontWeight: "bold", color: "#2196F3", marginBottom: 2 },
  sessionDate: { fontSize: 13, color: "#444", marginBottom: 2 },
  sessionType: { fontSize: 12, color: "#888" },
  sessionRight: { alignItems: "flex-end", gap: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  deleteBtn: { padding: 4 },
  deleteIcon: { fontSize: 16 },
});
