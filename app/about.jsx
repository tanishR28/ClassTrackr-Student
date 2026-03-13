import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FEATURES = [
  {
    icon: "📅",
    title: "Daily Timetable",
    desc: "Set which subjects you have on each day of the week. The home screen auto-loads today's classes.",
  },
  {
    icon: "✅",
    title: "Auto Attendance",
    desc: "If you don't open the app on a class day, attendance is counted as present automatically. Open the app only to mark yourself absent or cancelled.",
  },
  {
    icon: "❌",
    title: "Absent / Cancelled",
    desc: "Mark a class as Absent (total goes up, present stays) or Cancelled (nothing changes). Tap the same button again to undo.",
  },
  {
    icon: "📊",
    title: "Attendance %",
    desc: "Each subject shows your current attendance percentage and how many more classes you need to stay above your threshold.",
  },
  {
    icon: "🎯",
    title: "Custom Threshold",
    desc: "Set a custom attendance target per subject (default 75%). The app warns you when you're falling below it.",
  },
  {
    icon: "➕",
    title: "Extra Lectures",
    desc: "Tap '+ Extra Lecture' on the home screen to log a one-off class not in your weekly timetable.",
  },
  {
    icon: "⏸️",
    title: "Pause Timetable",
    desc: "Going on holiday or semester break? Set a pause period and the app will skip attendance counting for those dates entirely.",
  },
  {
    icon: "📝",
    title: "Manage Subjects",
    desc: "Add or remove subjects anytime. Create a Lecture Only, Lab Only, or Both (creates a paired theory + lab subject).",
  },
];

const HOW_TO_USE = [
  {
    step: "1",
    title: "Add your subjects",
    desc: 'Open the sidebar → Manage Subjects → tap "+ Add". Choose Lecture Only, Lab Only, or Both.',
  },
  {
    step: "2",
    title: "Set up your timetable",
    desc: "Open the sidebar → Timetable. Select each day and add the subjects you have on that day.",
  },
  {
    step: "3",
    title: "Use it daily",
    desc: "Open the app when you want to mark yourself absent or cancel a class. If you don't open it, attendance is recorded as present at day end.",
  },
  {
    step: "4",
    title: "Check your stats",
    desc: "Tap any subject on the home screen to see your full attendance counter and adjust it manually if needed.",
  },
  {
    step: "5",
    title: "Pause for holidays",
    desc: "Going on break? Open sidebar → Pause Timetable and set a date range. No attendance will be counted during that period.",
  },
];

export default function About() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* App identity */}
        <View style={styles.hero}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.heroLogo}
          />
          <Text style={styles.appName}>ClassTrackr</Text>
          <Text style={styles.appTagline}>Smart attendance tracking for students</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </View>
        </View>

        {/* Features */}
        <Text style={styles.sectionTitle}>FEATURES</Text>
        <View style={styles.card}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureRowBorder]}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* How to use */}
        <Text style={styles.sectionTitle}>HOW TO USE</Text>
        <View style={styles.card}>
          {HOW_TO_USE.map((h, i) => (
            <View key={i} style={[styles.stepRow, i < HOW_TO_USE.length - 1 && styles.featureRowBorder]}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{h.step}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{h.title}</Text>
                <Text style={styles.featureDesc}>{h.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBuilt}>Built with care for students</Text>
          <Text style={styles.footerDev}>Developed by Tanish Rane</Text>
        </View>
      </ScrollView>
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

  content: { padding: 16 },

  hero: {
    alignItems: "center",
    paddingVertical: 28,
  },
  heroLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 14,
  },
  appName: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", letterSpacing: -0.5 },
  appTagline: { fontSize: 14, color: "#888", marginTop: 4, textAlign: "center" },
  versionBadge: {
    marginTop: 10,
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  versionText: { fontSize: 12, color: "#1976D2", fontWeight: "600" },

  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    overflow: "hidden",
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  featureIcon: { fontSize: 22, marginTop: 1 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: "700", color: "#222", marginBottom: 3 },
  featureDesc: { fontSize: 13, color: "#777", lineHeight: 18 },

  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2196F3",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNum: { fontSize: 13, fontWeight: "800", color: "#fff" },

  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  footerBuilt: { fontSize: 12, color: "#bbb" },
  footerDev: { fontSize: 14, fontWeight: "700", color: "#555" },
});
