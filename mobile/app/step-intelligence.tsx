import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  getStepAnalytics,
  getStepAchievements,
  checkStepAchievements,
  getStepCoaching,
  type StepAnalytics,
  type StepAchievement,
  type StepCoaching,
} from "../src/api/steps";
import { useAuthStore } from "../src/stores/auth";

const GOAL = 10_000;

function CircularRing({ pct, steps, goal }: { pct: number; steps: number | null; goal: number }) {
  const clamped = Math.min(pct, 100);
  const color = clamped >= 100 ? "#10b981" : "#8b5cf6";
  return (
    <View style={styles.ringOuter}>
      <View style={[styles.ringInner, { borderColor: "#374151" }]}>
        <View
          style={[
            styles.ringFill,
            {
              borderColor: color,
              // Approximate progress using border trick
            },
          ]}
        />
        <View style={styles.ringCenter}>
          <Text style={[styles.ringSteps, { color }]}>
            {steps != null ? (steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps) : "—"}
          </Text>
          <Text style={styles.ringGoal}>/ {(goal / 1000).toFixed(0)}k</Text>
          <Text style={[styles.ringPct, { color }]}>{clamped.toFixed(0)}%</Text>
        </View>
      </View>
    </View>
  );
}

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function MiniBar({ steps, goal, date }: { steps: number; goal: number; date: string }) {
  const pct = Math.min(steps / goal, 1);
  const color = steps >= goal ? "#10b981" : steps >= goal * 0.75 ? "#8b5cf6" : "#4b5563";
  return (
    <View style={styles.barWrap}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { height: `${Math.max(pct * 100, 5)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barDate}>{date.slice(5)}</Text>
    </View>
  );
}

const ACHIEVEMENT_ICONS: Record<string, string> = {
  footprints: "footsteps-outline",
  "trending-up": "trending-up",
  trophy: "trophy-outline",
  flame: "flame-outline",
  star: "star-outline",
};

export default function StepIntelligenceScreen() {
  const user = useAuthStore((s) => s.user);
  const [analytics, setAnalytics] = useState<StepAnalytics | null>(null);
  const [achievements, setAchievements] = useState<StepAchievement[]>([]);
  const [coaching, setCoaching] = useState<StepCoaching | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const language = user?.preferred_language === "tr" ? "tr" : "en";

  const load = useCallback(async () => {
    try {
      const [a, ach, c] = await Promise.allSettled([
        getStepAnalytics(GOAL),
        getStepAchievements(),
        getStepCoaching(language, GOAL),
      ]);
      if (a.status === "fulfilled") setAnalytics(a.value);
      if (ach.status === "fulfilled") setAchievements(ach.value);
      if (c.status === "fulfilled") setCoaching(c.value);
      // Check for new achievements in background
      checkStepAchievements(GOAL).then((newOnes) => {
        if (newOnes.length > 0) {
          getStepAchievements().then(setAchievements).catch(() => {});
        }
      }).catch(() => {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const chartData = (analytics?.daily_history ?? []).slice(0, 14).reverse();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#f9fafb" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step Intelligence</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={22} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
        >
          {analytics && (
            <>
              {/* Progress Ring + Stats */}
              <View style={styles.heroCard}>
                <CircularRing pct={analytics.today_pct} steps={analytics.today_steps} goal={analytics.today_goal} />
                <View style={styles.heroStats}>
                  <StatPill label="Today" value={analytics.today_steps?.toLocaleString() ?? "—"} sub="steps" />
                  <StatPill
                    label="Remaining"
                    value={
                      analytics.remaining_today != null && analytics.remaining_today > 0
                        ? analytics.remaining_today.toLocaleString()
                        : analytics.today_pct >= 100 ? "Done ✓" : "—"
                    }
                    sub={analytics.remaining_today != null && analytics.remaining_today > 0 ? "to goal" : ""}
                  />
                </View>
              </View>

              {/* Week-over-week badge */}
              {analytics.week_over_week_pct != null && (
                <View style={[
                  styles.wowBadge,
                  { backgroundColor: analytics.week_over_week_pct >= 0 ? "#064e3b30" : "#7f1d1d30" }
                ]}>
                  <Ionicons
                    name={analytics.week_over_week_pct >= 0 ? "trending-up" : "trending-down"}
                    size={18}
                    color={analytics.week_over_week_pct >= 0 ? "#10b981" : "#ef4444"}
                  />
                  <Text style={[styles.wowText, { color: analytics.week_over_week_pct >= 0 ? "#10b981" : "#ef4444" }]}>
                    {analytics.week_over_week_pct > 0 ? "+" : ""}{analytics.week_over_week_pct.toFixed(1)}% vs last week
                  </Text>
                </View>
              )}

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <StatPill label="This Week" value={analytics.this_week_total.toLocaleString()} sub="steps total" />
                <StatPill label="Daily Avg" value={Math.round(analytics.this_week_avg_daily).toLocaleString()} sub="steps/day" />
                <StatPill label="Active Days" value={`${analytics.active_days_this_week}/7`} sub="this week" />
                <StatPill label="This Month" value={analytics.this_month_total.toLocaleString()} sub="steps total" />
              </View>

              {/* Best Day */}
              {analytics.best_day && (
                <View style={styles.bestDayCard}>
                  <Ionicons name="trophy-outline" size={18} color="#f59e0b" />
                  <Text style={styles.bestDayText}>
                    Best: {analytics.best_day.steps.toLocaleString()} steps on {analytics.best_day.date}
                  </Text>
                </View>
              )}

              {/* 14-day bar chart */}
              {chartData.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.sectionTitle}>Last {chartData.length} Days</Text>
                  <View style={styles.barChart}>
                    {chartData.map((d) => (
                      <MiniBar key={d.date} steps={d.steps} goal={analytics.today_goal} date={d.date} />
                    ))}
                  </View>
                  <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: "#10b981" }]} />
                      <Text style={styles.legendText}>Goal met</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: "#8b5cf6" }]} />
                      <Text style={styles.legendText}>75%+</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: "#4b5563" }]} />
                      <Text style={styles.legendText}>Below</Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}

          {/* AI Coaching */}
          {coaching && (
            <View style={styles.coachCard}>
              <View style={styles.coachHeader}>
                <Ionicons name="sparkles" size={16} color="#a78bfa" />
                <Text style={styles.coachTitle}>
                  {coaching.coaching_source === "ai" ? "AI Coach" : "Coach"}
                </Text>
              </View>
              {coaching.warning && (
                <View style={styles.warningRow}>
                  <Ionicons name="warning-outline" size={15} color="#f59e0b" />
                  <Text style={styles.warningText}>{coaching.warning}</Text>
                </View>
              )}
              <Text style={styles.coachRec}>{coaching.recommendation}</Text>
              <View style={styles.goalRow}>
                <Ionicons name="flash-outline" size={14} color="#8b5cf6" />
                <Text style={styles.goalText}>{coaching.movement_goal}</Text>
              </View>
            </View>
          )}

          {/* Achievements */}
          {achievements.length > 0 && (
            <View style={styles.achievementsSection}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <View style={styles.achievementsGrid}>
                {achievements.map((a) => (
                  <View key={a.key} style={styles.achievementBadge}>
                    <Ionicons
                      name={(ACHIEVEMENT_ICONS[a.icon] ?? "trophy-outline") as any}
                      size={20}
                      color="#f59e0b"
                    />
                    <Text style={styles.achievementTitle}>{a.title}</Text>
                    <Text style={styles.achievementNotes} numberOfLines={1}>{a.notes ?? a.description}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!analytics && (
            <View style={styles.emptyState}>
              <Ionicons name="footsteps-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>No step data yet.</Text>
              <Text style={styles.emptySubText}>Connect Apple Health or Health Connect to start tracking steps.</Text>
              <TouchableOpacity style={styles.connectBtn} onPress={() => router.push("/health-sync")}>
                <Text style={styles.connectBtnText}>Connect Health Platform</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f9fafb" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },

  heroCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: "#1f2937", borderRadius: 20, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: "#374151",
  },

  // Circular ring approximated with nested views
  ringOuter: { alignItems: "center", justifyContent: "center" },
  ringInner: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 8, alignItems: "center", justifyContent: "center",
  },
  ringFill: { position: "absolute" },
  ringCenter: { alignItems: "center" },
  ringSteps: { fontSize: 22, fontWeight: "800", lineHeight: 24 },
  ringGoal: { fontSize: 11, color: "#6b7280", marginTop: 1 },
  ringPct: { fontSize: 13, fontWeight: "700", marginTop: 2 },

  heroStats: { flex: 1, gap: 12 },
  statPill: {
    backgroundColor: "#111827", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#374151",
  },
  statLabel: { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#f9fafb" },
  statSub: { fontSize: 10, color: "#9ca3af" },

  wowBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  wowText: { fontSize: 14, fontWeight: "700" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },

  bestDayCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1f2937", borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#374151",
  },
  bestDayText: { fontSize: 13, color: "#d1d5db", flex: 1 },

  chartCard: {
    backgroundColor: "#1f2937", borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "#374151",
  },
  sectionTitle: {
    fontSize: 12, color: "#9ca3af", fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12,
  },
  barChart: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: 4 },
  barWrap: { flex: 1, alignItems: "center", gap: 3 },
  barTrack: {
    flex: 1, width: "100%", backgroundColor: "#374151", borderRadius: 3,
    overflow: "hidden", justifyContent: "flex-end",
  },
  barFill: { width: "100%", borderRadius: 3 },
  barDate: { fontSize: 8, color: "#6b7280", textAlign: "center" },
  chartLegend: { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: "#6b7280" },

  coachCard: {
    backgroundColor: "#1e1b4b", borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "#4c1d95",
  },
  coachHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  coachTitle: { fontSize: 11, fontWeight: "700", color: "#a78bfa", textTransform: "uppercase", letterSpacing: 0.8 },
  warningRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 8 },
  warningText: { fontSize: 12, color: "#fbbf24", flex: 1, lineHeight: 17 },
  coachRec: { fontSize: 15, color: "#f9fafb", lineHeight: 22, marginBottom: 10 },
  goalRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  goalText: { fontSize: 12, color: "#a78bfa", flex: 1, lineHeight: 17 },

  achievementsSection: { marginBottom: 12 },
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementBadge: {
    backgroundColor: "#1f2937", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#78350f", alignItems: "center",
    minWidth: 100, gap: 4, flex: 1,
  },
  achievementTitle: { fontSize: 12, fontWeight: "700", color: "#fbbf24", textAlign: "center" },
  achievementNotes: { fontSize: 10, color: "#6b7280", textAlign: "center" },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#9ca3af" },
  emptySubText: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
  connectBtn: { backgroundColor: "#8b5cf6", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  connectBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
