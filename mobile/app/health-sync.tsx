import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, CardContent } from "../src/components/ui/Card";
import { Button } from "../src/components/ui/Button";
import { Colors, Spacing, Radius } from "../src/constants/colors";
import { useHealthStore } from "../src/stores/health";
import {
  isAvailable,
  requestPermissions,
  getPermissionStatus,
  fetchDailySummary,
  fetchWorkouts,
  SOURCE_NAME,
  SOURCE_KEY,
} from "../src/services/health";
import { pushHealthSync, getHealthSummary, importWorkout } from "../src/api/health";
import type { ImportedWorkout } from "../src/services/health/types";
import type { HealthSyncRecord } from "../src/api/health";

const todayISO = () => new Date().toISOString().split("T")[0];

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function StatRow({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        {sub && <Text style={styles.statSub}>{sub}</Text>}
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function HealthSyncScreen() {
  const {
    isConnected, source, permissionStatus, autoSync, lastSyncAt, todayData,
    setConnected, setPermissionStatus, setAutoSync, setLastSyncAt, setTodayData,
    markWorkoutImported, isWorkoutImported, disconnect,
  } = useHealthStore();

  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<ImportedWorkout[]>([]);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [history, setHistory] = useState<HealthSyncRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const checkAvailability = useCallback(async () => {
    const available = await isAvailable();
    setPlatformAvailable(available);

    if (available) {
      const status = await getPermissionStatus();
      setPermissionStatus(status);
      if (status === "authorized" && !isConnected) {
        setConnected(true, SOURCE_KEY);
      }
    }
  }, [isConnected, setConnected, setPermissionStatus]);

  const loadHistory = useCallback(async () => {
    try {
      const summary = await getHealthSummary(7);
      setHistory(summary.history);
    } catch { }
  }, []);

  const loadRecentWorkouts = useCallback(async () => {
    if (!isConnected) return;
    try {
      const workouts = await fetchWorkouts(nDaysAgo(7), todayISO());
      setRecentWorkouts(workouts);
    } catch { }
  }, [isConnected]);

  useEffect(() => {
    checkAvailability();
    loadHistory();
  }, [checkAvailability, loadHistory]);

  useEffect(() => {
    if (isConnected) loadRecentWorkouts();
  }, [isConnected, loadRecentWorkouts]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const granted = await requestPermissions();
      if (granted) {
        setConnected(true, SOURCE_KEY);
        setPermissionStatus("authorized");
        await handleSync(true);
        await loadRecentWorkouts();
      } else {
        Alert.alert(
          "Permission Required",
          `Please grant ${SOURCE_NAME} permissions to sync your activity data.`
        );
        setPermissionStatus("denied");
      }
    } catch {
      Alert.alert("Error", "Could not connect to health platform.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync(silent = false) {
    if (!isConnected) return;
    setSyncing(true);
    try {
      const data = await fetchDailySummary(todayISO());
      setTodayData(data);

      await pushHealthSync({
        log_date: data.date,
        source: SOURCE_KEY,
        steps: data.steps,
        distance_km: data.distanceKm,
        active_calories: data.activeCalories,
      });

      setLastSyncAt(new Date().toISOString());
      await loadHistory();

      if (!silent) Alert.alert("Synced!", "Today's health data has been updated.");
    } catch {
      if (!silent) Alert.alert("Sync Failed", "Could not sync health data. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleImportWorkout(workout: ImportedWorkout) {
    const key = `${workout.startDate}_${workout.name}`;
    if (isWorkoutImported(key)) return;
    setImportingKey(key);
    try {
      await importWorkout({
        name: workout.name,
        workout_type: workout.workoutType,
        logged_at: workout.startDate,
        duration_minutes: workout.durationMinutes,
        active_calories: workout.activeCalories,
        distance_km: workout.distanceKm,
        source: workout.source,
      });
      markWorkoutImported(key);
      Alert.alert("Imported!", `"${workout.name}" added to your workout log.`);
    } catch {
      Alert.alert("Error", "Failed to import workout.");
    } finally {
      setImportingKey(null);
    }
  }

  function handleDisconnect() {
    Alert.alert(
      "Disconnect",
      `Stop syncing from ${SOURCE_NAME}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: disconnect },
      ]
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([checkAvailability(), loadHistory(), loadRecentWorkouts()]);
    setRefreshing(false);
  }

  const displayData = todayData;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Health Sync</Text>
        {isConnected && (
          <TouchableOpacity onPress={() => handleSync()} disabled={syncing} style={styles.syncBtn}>
            {syncing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="sync" size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>
        )}
        {!isConnected && <View style={{ width: 44 }} />}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >

        {/* Platform availability check */}
        {platformAvailable === false && (
          <View style={styles.unavailableBanner}>
            <Ionicons name="warning-outline" size={20} color="#92400e" />
            <Text style={styles.unavailableText}>
              {SOURCE_NAME} is not available on this device. Health Connect requires Android 9+ with Health Connect installed.
            </Text>
          </View>
        )}

        {/* Connection card */}
        <Card style={[styles.connectionCard, isConnected && styles.connectionCardActive]}>
          <CardContent>
            <View style={styles.connRow}>
              <View style={[styles.platformIcon, isConnected && styles.platformIconActive]}>
                <Ionicons
                  name={SOURCE_KEY === "apple_health" ? "heart-circle" : "fitness"}
                  size={28}
                  color={isConnected ? Colors.white : Colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformName}>{SOURCE_NAME}</Text>
                <View style={styles.connStatus}>
                  <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.textMuted }]} />
                  <Text style={[styles.connStatusText, { color: isConnected ? Colors.success : Colors.textMuted }]}>
                    {isConnected ? "Connected" : permissionStatus === "denied" ? "Permission denied" : "Not connected"}
                  </Text>
                </View>
                {isConnected && lastSyncAt && (
                  <Text style={styles.lastSync}>Last synced: {fmtDateTime(lastSyncAt)}</Text>
                )}
              </View>
            </View>

            {!isConnected ? (
              <Button
                fullWidth
                loading={connecting}
                onPress={handleConnect}
                disabled={platformAvailable === false}
                style={{ marginTop: Spacing.md }}
              >
                {`Connect ${SOURCE_NAME}`}
              </Button>
            ) : (
              <View style={styles.connActions}>
                <Button variant="outline" onPress={() => handleSync()} loading={syncing} style={{ flex: 1 }}>
                  Sync Now
                </Button>
                <Button variant="ghost" onPress={handleDisconnect} style={{ flex: 1 }}>
                  Disconnect
                </Button>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Auto-sync toggle */}
        {isConnected && (
          <Card>
            <CardContent>
              <View style={styles.autoSyncRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.autoSyncLabel}>Auto Sync</Text>
                  <Text style={styles.autoSyncSub}>Sync when you open the app</Text>
                </View>
                <Switch
                  value={autoSync}
                  onValueChange={setAutoSync}
                  trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
                  thumbColor={autoSync ? Colors.primary : Colors.textMuted}
                />
              </View>
            </CardContent>
          </Card>
        )}

        {/* Today's activity */}
        {isConnected && (
          <>
            <Text style={styles.sectionTitle}>Today's Activity</Text>
            <Card>
              <CardContent style={{ gap: 0 }}>
                <StatRow
                  icon="footsteps"
                  label="Steps"
                  value={displayData?.steps != null ? displayData.steps.toLocaleString() : "—"}
                  sub="daily total"
                />
                <View style={styles.divider} />
                <StatRow
                  icon="location"
                  label="Distance"
                  value={displayData?.distanceKm != null ? `${displayData.distanceKm.toFixed(2)} km` : "—"}
                />
                <View style={styles.divider} />
                <StatRow
                  icon="flame"
                  label="Active Calories"
                  value={displayData?.activeCalories != null ? `${displayData.activeCalories} kcal` : "—"}
                  sub="burned"
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Recent workouts from health platform */}
        {isConnected && recentWorkouts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Workouts (last 7 days)</Text>
            <Card>
              <CardContent style={{ gap: 0 }}>
                {recentWorkouts.map((w, i) => {
                  const key = `${w.startDate}_${w.name}`;
                  const imported = isWorkoutImported(key);
                  const isImporting = importingKey === key;
                  return (
                    <View key={key} style={[styles.workoutRow, i > 0 && styles.workoutBorder]}>
                      <View style={styles.workoutIcon}>
                        <Ionicons name="barbell" size={16} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workoutName}>{w.name}</Text>
                        <Text style={styles.workoutMeta}>
                          {[
                            w.durationMinutes ? `${w.durationMinutes} min` : null,
                            w.activeCalories ? `${w.activeCalories} kcal` : null,
                            w.distanceKm ? `${w.distanceKm} km` : null,
                            new Date(w.startDate).toLocaleDateString(),
                          ].filter(Boolean).join("  ·  ")}
                        </Text>
                      </View>
                      {imported ? (
                        <View style={styles.importedBadge}>
                          <Ionicons name="checkmark" size={14} color={Colors.success} />
                          <Text style={styles.importedText}>Imported</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleImportWorkout(w)}
                          disabled={isImporting}
                          style={styles.importBtn}
                        >
                          {isImporting ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : (
                            <Text style={styles.importBtnText}>Import</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </CardContent>
            </Card>
          </>
        )}

        {/* Sync history */}
        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sync History</Text>
            <Card>
              <CardContent style={{ gap: 0 }}>
                {history.map((h, i) => (
                  <View key={h.id} style={[styles.historyRow, i > 0 && styles.workoutBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyDate}>{new Date(h.log_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Text>
                      <Text style={styles.historyMeta}>
                        {[
                          h.steps ? `${h.steps.toLocaleString()} steps` : null,
                          h.distance_km ? `${h.distance_km.toFixed(1)} km` : null,
                          h.active_calories ? `${Math.round(h.active_calories)} kcal` : null,
                        ].filter(Boolean).join("  ·  ") || "No data"}
                      </Text>
                    </View>
                    <Text style={styles.historySource}>{h.source.replace("_", " ")}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty state */}
        {!isConnected && platformAvailable !== false && (
          <View style={styles.emptyState}>
            <Ionicons name="heart-circle-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>Connect {SOURCE_NAME}</Text>
            <Text style={styles.emptySub}>
              Automatically import steps, distance, active calories, and workouts — no manual entry needed.
            </Text>
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.card },

  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: Colors.text, marginLeft: Spacing.sm },
  syncBtn: { width: 44, alignItems: "center" },

  scroll: { padding: Spacing.md, gap: Spacing.sm },

  unavailableBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm,
    backgroundColor: "#fef3c7", borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: "#fcd34d",
  },
  unavailableText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },

  connectionCard: { borderWidth: 1, borderColor: Colors.border },
  connectionCardActive: { borderColor: Colors.primary + "60", borderWidth: 1.5 },
  connRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  platformIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.card, alignItems: "center", justifyContent: "center",
  },
  platformIconActive: { backgroundColor: Colors.primary },
  platformName: { fontSize: 17, fontWeight: "700", color: Colors.text },
  connStatus: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  connStatusText: { fontSize: 13, fontWeight: "600" },
  lastSync: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  connActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },

  autoSyncRow: { flexDirection: "row", alignItems: "center" },
  autoSyncLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
  autoSyncSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginTop: Spacing.xs },

  statRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm + 2 },
  statIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 14, fontWeight: "600", color: Colors.text },
  statSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  statValue: { fontSize: 16, fontWeight: "700", color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 44 },

  workoutRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: 12 },
  workoutBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  workoutIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  workoutName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  workoutMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  importedBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  importedText: { fontSize: 12, fontWeight: "600", color: Colors.success },
  importBtn: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
  importBtnText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  historyDate: { fontSize: 13, fontWeight: "600", color: Colors.text },
  historyMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  historySource: { fontSize: 10, color: Colors.textMuted, textTransform: "capitalize" },

  emptyState: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: "center", lineHeight: 20, paddingHorizontal: Spacing.md },
});
