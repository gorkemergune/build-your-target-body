import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, CardHeader, CardContent } from "../../src/components/ui/Card";
import { StatCard } from "../../src/components/ui/StatCard";
import { LoadingScreen } from "../../src/components/ui/LoadingScreen";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { getDashboard } from "../../src/api/analytics";
import { useAuthStore } from "../../src/stores/auth";
import { useHealthStore } from "../../src/stores/health";
import { useWearableStore } from "../../src/stores/wearable";
import { fetchDailySummary, SOURCE_NAME, SOURCE_KEY } from "../../src/services/health";
import { pushHealthSync } from "../../src/api/health";
import { getWearableScores } from "../../src/api/wearable";
import { getStepAnalytics, type StepAnalytics } from "../../src/api/steps";
import { formatWeight, formatCalories, formatRelativeDate, goalTypeLabel } from "../../src/lib/utils";
import type { DashboardData } from "../../src/types";

const todayISO = () => new Date().toISOString().split("T")[0];

const SCORE_COLOR: Record<string, string> = {
  Peak: "#10b981",
  Good: "#3b82f6",
  Moderate: "#f59e0b",
  Low: "#ef4444",
};

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { isConnected, autoSync, todayData, setTodayData, setLastSyncAt } = useHealthStore();
  const { scores, setScores, connectedCount } = useWearableStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [stepData, setStepData] = useState<StepAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [d, s, steps] = await Promise.allSettled([getDashboard(), getWearableScores(), getStepAnalytics()]);
      if (d.status === "fulfilled") setData(d.value);
      if (s.status === "fulfilled") setScores(s.value);
      if (steps.status === "fulfilled") setStepData(steps.value);
    } catch {
      // Show empty state on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function autoSyncHealth() {
    if (!isConnected || !autoSync) return;
    try {
      const healthData = await fetchDailySummary(todayISO());
      setTodayData(healthData);
      await pushHealthSync({
        log_date: healthData.date,
        source: SOURCE_KEY,
        steps: healthData.steps,
        distance_km: healthData.distanceKm,
        active_calories: healthData.activeCalories,
        resting_heart_rate_bpm: healthData.restingHeartRateBpm,
        avg_heart_rate_bpm: healthData.avgHeartRateBpm,
        max_heart_rate_bpm: healthData.maxHeartRateBpm,
      });
      setLastSyncAt(new Date().toISOString());
    } catch { }
  }

  useEffect(() => {
    fetchData();
    autoSyncHealth();
  }, []);

  if (loading) return <LoadingScreen />;

  const firstName = user?.full_name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={styles.avatarBtn}>
            <Ionicons name="person-circle" size={42} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Goal Progress */}
        {data?.active_goal && (
          <Card style={styles.goalCard}>
            <CardContent>
              <View style={styles.goalRow}>
                <View>
                  <Text style={styles.goalLabel}>Active Goal</Text>
                  <Text style={styles.goalType}>{goalTypeLabel(data.active_goal.goal_type)}</Text>
                </View>
                {data.active_goal.progress_pct != null && (
                  <View style={styles.progressBadge}>
                    <Text style={styles.progressText}>{Math.round(data.active_goal.progress_pct)}%</Text>
                  </View>
                )}
              </View>
              {data.active_goal.progress_pct != null && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(data.active_goal.progress_pct, 100)}%` }]} />
                </View>
              )}
              {data.active_goal.days_remaining != null && (
                <Text style={styles.daysRemaining}>{data.active_goal.days_remaining} days remaining</Text>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stat Grid */}
        <View style={styles.statGrid}>
          <StatCard
            label="Weight"
            value={formatWeight(data?.latest_weight_kg ?? null)}
            sub="latest"
            style={{ flex: 1 }}
          />
          <StatCard
            label="Body Fat"
            value={data?.latest_body_fat_pct != null ? `${data.latest_body_fat_pct}%` : "—"}
            sub="latest"
            style={{ flex: 1 }}
          />
        </View>
        <View style={styles.statGrid}>
          <StatCard
            label="Today's Calories"
            value={formatCalories(data?.todays_calories ?? null)}
            sub="consumed"
            accentColor={Colors.warning}
            style={{ flex: 1 }}
          />
          <StatCard
            label="Workouts"
            value={data?.workouts_this_week != null ? String(data.workouts_this_week) : "—"}
            sub="this week"
            accentColor={Colors.primary}
            style={{ flex: 1 }}
          />
        </View>

        {/* Health Platform Card */}
        {isConnected && todayData && (
          <TouchableOpacity onPress={() => router.push("/health-sync")} activeOpacity={0.8}>
            <Card style={styles.healthCard}>
              <CardContent>
                <View style={styles.healthHeader}>
                  <Ionicons name={SOURCE_KEY === "apple_health" ? "heart-circle" : "fitness"} size={18} color={Colors.primary} />
                  <Text style={styles.healthSource}>{SOURCE_NAME}</Text>
                  <View style={styles.syncedBadge}>
                    <View style={styles.syncedDot} />
                    <Text style={styles.syncedText}>Synced</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
                </View>
                <View style={styles.healthStats}>
                  <View style={styles.healthStat}>
                    <Ionicons name="footsteps" size={16} color={Colors.textSecondary} />
                    <Text style={styles.healthStatValue}>{todayData.steps.toLocaleString()}</Text>
                    <Text style={styles.healthStatLabel}>steps</Text>
                  </View>
                  <View style={styles.healthDivider} />
                  <View style={styles.healthStat}>
                    <Ionicons name="location" size={16} color={Colors.textSecondary} />
                    <Text style={styles.healthStatValue}>{todayData.distanceKm.toFixed(1)}</Text>
                    <Text style={styles.healthStatLabel}>km</Text>
                  </View>
                  <View style={styles.healthDivider} />
                  <View style={styles.healthStat}>
                    <Ionicons name="flame" size={16} color={Colors.textSecondary} />
                    <Text style={styles.healthStatValue}>{todayData.activeCalories}</Text>
                    <Text style={styles.healthStatLabel}>kcal</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </TouchableOpacity>
        )}

        {/* Wearable Scores Card */}
        {scores && (
          <TouchableOpacity onPress={() => router.push("/wearables")} activeOpacity={0.8}>
            <Card style={styles.scoresCard}>
              <CardContent>
                <View style={styles.scoresHeader}>
                  <Ionicons name="watch-outline" size={16} color={Colors.primary} />
                  <Text style={styles.scoresTitle}>Today's Scores</Text>
                  {connectedCount() > 0 && (
                    <View style={styles.syncedBadge}>
                      <View style={styles.syncedDot} />
                      <Text style={styles.syncedText}>{connectedCount()} device{connectedCount() > 1 ? "s" : ""}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
                </View>
                <View style={styles.scoresRow}>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>Readiness</Text>
                    <Text style={[styles.scoreNum, { color: SCORE_COLOR[scores.readiness.label] }]}>{scores.readiness.score}</Text>
                    <Text style={[styles.scoreChip, { color: SCORE_COLOR[scores.readiness.label] }]}>{scores.readiness.label}</Text>
                  </View>
                  <View style={styles.scoreDivider} />
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>Recovery</Text>
                    <Text style={[styles.scoreNum, { color: SCORE_COLOR[scores.recovery.label] }]}>{scores.recovery.score}</Text>
                    <Text style={[styles.scoreChip, { color: SCORE_COLOR[scores.recovery.label] }]}>{scores.recovery.label}</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </TouchableOpacity>
        )}

        {/* Step Intelligence Card */}
        {stepData && (
          <TouchableOpacity onPress={() => router.push("/step-intelligence")} activeOpacity={0.8}>
            <Card style={styles.stepCard}>
              <CardContent>
                <View style={styles.stepHeader}>
                  <Ionicons name="footsteps" size={16} color="#8b5cf6" />
                  <Text style={styles.stepTitle}>Step Intelligence</Text>
                  {stepData.today_pct >= 100 && (
                    <View style={[styles.syncedBadge, { backgroundColor: "#d1fae520" }]}>
                      <View style={[styles.syncedDot, { backgroundColor: "#10b981" }]} />
                      <Text style={[styles.syncedText, { color: "#10b981" }]}>Goal met!</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
                </View>
                <View style={styles.stepBody}>
                  <View style={styles.stepStepsWrap}>
                    <Text style={[styles.stepStepsNum, { color: stepData.today_pct >= 100 ? "#10b981" : "#8b5cf6" }]}>
                      {stepData.today_steps != null ? stepData.today_steps.toLocaleString() : "—"}
                    </Text>
                    <Text style={styles.stepGoalText}>/ {stepData.today_goal.toLocaleString()} goal</Text>
                  </View>
                  <View style={styles.stepDivider} />
                  <View style={styles.stepMeta}>
                    <Text style={styles.stepMetaLabel}>Week avg</Text>
                    <Text style={styles.stepMetaValue}>{Math.round(stepData.this_week_avg_daily).toLocaleString()}</Text>
                    {stepData.week_over_week_pct != null && (
                      <Text style={[styles.stepWow, { color: stepData.week_over_week_pct >= 0 ? "#10b981" : "#ef4444" }]}>
                        {stepData.week_over_week_pct > 0 ? "+" : ""}{stepData.week_over_week_pct.toFixed(0)}%
                      </Text>
                    )}
                  </View>
                </View>
                {/* Progress bar */}
                <View style={styles.stepProgressTrack}>
                  <View style={[styles.stepProgressFill, {
                    width: `${Math.min(stepData.today_pct, 100)}%` as any,
                    backgroundColor: stepData.today_pct >= 100 ? "#10b981" : "#8b5cf6",
                  }]} />
                </View>
                {stepData.remaining_today != null && stepData.remaining_today > 0 && (
                  <Text style={styles.stepRemaining}>
                    {stepData.remaining_today.toLocaleString()} steps to goal
                  </Text>
                )}
              </CardContent>
            </Card>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Log</Text>
        <View style={styles.quickActions}>
          {[
            { label: "Log Weight", icon: "scale" as const, route: "/(tabs)/weight" as const },
            { label: "Log Food", icon: "nutrition" as const, route: "/(tabs)/nutrition" as const },
            { label: "Log Workout", icon: "barbell" as const, route: "/(tabs)/workouts" as const },
            { label: "Ask AI", icon: "chatbubble-ellipses" as const, route: "/(tabs)/ai-coach" as const },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickAction}
              onPress={() => router.push(action.route)}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon} size={22} color={Colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Workouts */}
        {(data?.recent_workouts?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            <Card>
              {(data?.recent_workouts ?? []).slice(0, 5).map((w, i) => (
                <View key={w.id} style={[styles.workoutRow, i > 0 && styles.workoutBorder]}>
                  <View style={styles.workoutIcon}>
                    <Ionicons name="barbell" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workoutName}>{w.name}</Text>
                    <Text style={styles.workoutMeta}>{formatRelativeDate(w.logged_at)}</Text>
                  </View>
                  {w.duration_minutes && (
                    <Text style={styles.workoutDuration}>{w.duration_minutes} min</Text>
                  )}
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.card },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.xs },
  greeting: { fontSize: 20, fontWeight: "800", color: Colors.text },
  date: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  avatarBtn: { padding: 4 },

  goalCard: { borderColor: Colors.primary + "40", borderWidth: 1.5 },
  goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  goalType: { fontSize: 17, fontWeight: "700", color: Colors.text, marginTop: 2 },
  progressBadge: { backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  progressText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, marginTop: Spacing.sm, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  daysRemaining: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },

  statGrid: { flexDirection: "row", gap: Spacing.sm },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginTop: Spacing.xs },

  quickActions: { flexDirection: "row", gap: Spacing.sm },
  quickAction: { flex: 1, alignItems: "center", gap: 6 },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: { fontSize: 11, fontWeight: "600", color: Colors.text, textAlign: "center" },

  workoutRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  workoutBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  workoutIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  workoutName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  workoutMeta: { fontSize: 12, color: Colors.textMuted },
  workoutDuration: { fontSize: 13, color: Colors.textSecondary },

  healthCard: { borderWidth: 1.5, borderColor: Colors.primary + "30" },
  healthHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  healthSource: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  syncedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.successLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  syncedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  syncedText: { fontSize: 10, fontWeight: "700", color: Colors.success },
  healthStats: { flexDirection: "row", alignItems: "center" },
  healthStat: { flex: 1, alignItems: "center", gap: 3 },
  healthStatValue: { fontSize: 20, fontWeight: "800", color: Colors.text },
  healthStatLabel: { fontSize: 10, color: Colors.textMuted, textTransform: "uppercase" },
  healthDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  scoresCard: { borderWidth: 1.5, borderColor: "#6d28d940" },
  scoresHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  scoresTitle: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  scoresRow: { flexDirection: "row", alignItems: "center" },
  scoreItem: { flex: 1, alignItems: "center", gap: 2 },
  scoreLabel: { fontSize: 11, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  scoreNum: { fontSize: 28, fontWeight: "800" },
  scoreChip: { fontSize: 11, fontWeight: "700" },
  scoreDivider: { width: 1, height: 48, backgroundColor: Colors.border },

  stepCard: { borderWidth: 1.5, borderColor: "#6d28d940" },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  stepTitle: { fontSize: 13, fontWeight: "700", color: "#8b5cf6" },
  stepBody: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  stepStepsWrap: { flex: 1 },
  stepStepsNum: { fontSize: 28, fontWeight: "800" },
  stepGoalText: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  stepDivider: { width: 1, height: 40, backgroundColor: Colors.border, marginHorizontal: 12 },
  stepMeta: { alignItems: "center", gap: 2 },
  stepMetaLabel: { fontSize: 10, color: Colors.textMuted, textTransform: "uppercase" },
  stepMetaValue: { fontSize: 16, fontWeight: "700", color: Colors.text },
  stepWow: { fontSize: 11, fontWeight: "700" },
  stepProgressTrack: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  stepProgressFill: { height: 5, borderRadius: 3 },
  stepRemaining: { fontSize: 11, color: Colors.textMuted },
});
