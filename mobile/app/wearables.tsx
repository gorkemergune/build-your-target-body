import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useWearableStore } from "../src/stores/wearable";
import {
  getConnections,
  getWearableScores,
  disconnectWearable,
  connectWearable,
  syncFitbit,
  type WearablePlatform,
  type WearableConnection,
} from "../src/api/wearable";
import { connectFitbit } from "../src/services/fitbit";

type ScoreLabel = "Peak" | "Good" | "Moderate" | "Low";

const SCORE_COLORS: Record<ScoreLabel, string> = {
  Peak: "#10b981",
  Good: "#3b82f6",
  Moderate: "#f59e0b",
  Low: "#ef4444",
};

const PLATFORM_INFO: Record<WearablePlatform, { name: string; icon: string; description: string; color: string }> = {
  apple_watch: { name: "Apple Watch", icon: "watch-outline", description: "Sync workouts, steps & heart rate from Apple Watch via Apple Health", color: "#000000" },
  garmin: { name: "Garmin", icon: "fitness-outline", description: "Sync Garmin device data including runs, rides and health metrics", color: "#007cc2" },
  fitbit: { name: "Fitbit", icon: "pulse-outline", description: "Connect your Fitbit account for automatic daily activity sync", color: "#00b0b9" },
};

function DeviceCard({
  platform,
  connection,
  onConnect,
  onDisconnect,
  onSync,
  loading,
}: {
  platform: WearablePlatform;
  connection?: WearableConnection;
  onConnect: (p: WearablePlatform) => void;
  onDisconnect: (p: WearablePlatform) => void;
  onSync: (p: WearablePlatform) => void;
  loading: boolean;
}) {
  const info = PLATFORM_INFO[platform];
  const connected = connection?.is_connected ?? false;

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={[styles.deviceIconWrap, { backgroundColor: info.color + "18" }]}>
          <Ionicons name={info.icon as any} size={24} color={info.color} />
        </View>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{info.name}</Text>
          <Text style={styles.deviceDesc}>{info.description}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: connected ? "#10b981" : "#6b7280" }]} />
      </View>

      {connected && connection?.last_sync_at && (
        <Text style={styles.lastSync}>
          Last sync: {new Date(connection.last_sync_at).toLocaleDateString()}
        </Text>
      )}

      <View style={styles.deviceActions}>
        {connected ? (
          <>
            {platform === "fitbit" && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.syncBtn]}
                onPress={() => onSync(platform)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <Text style={styles.syncBtnText}>Sync Now</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.disconnectBtn]}
              onPress={() => onDisconnect(platform)}
            >
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.connectBtn]}
            onPress={() => onConnect(platform)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.connectBtnText}>Connect</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function WearablesScreen() {
  const { connections, scores, setConnections, setScores, addOrUpdateConnection, removeConnection, getConnection } =
    useWearableStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<WearablePlatform | null>(null);

  const load = useCallback(async () => {
    try {
      const [conns, s] = await Promise.all([getConnections(), getWearableScores()]);
      setConnections(conns);
      setScores(s);
    } catch {
      // ignore — cached data shown
    }
  }, [setConnections, setScores]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleConnect = async (platform: WearablePlatform) => {
    setActionLoading(platform);
    try {
      if (platform === "fitbit") {
        const conn = await connectFitbit();
        if (conn) {
          addOrUpdateConnection(conn);
          await load();
        } else {
          Alert.alert("Fitbit", "Connection was cancelled or failed. Please try again.");
        }
      } else {
        const displayNames: Record<WearablePlatform, string> = {
          apple_watch: "Apple Watch",
          garmin: "Garmin",
          fitbit: "Fitbit",
        };
        const conn = await connectWearable(platform, displayNames[platform]);
        addOrUpdateConnection(conn);
        Alert.alert("Connected", `${PLATFORM_INFO[platform].name} has been connected.`);
      }
    } catch {
      Alert.alert("Error", "Failed to connect. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = (platform: WearablePlatform) => {
    Alert.alert(
      "Disconnect",
      `Are you sure you want to disconnect ${PLATFORM_INFO[platform].name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectWearable(platform);
              removeConnection(platform);
            } catch {
              Alert.alert("Error", "Failed to disconnect. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleSync = async (platform: WearablePlatform) => {
    setActionLoading(platform);
    try {
      if (platform === "fitbit") {
        const result = await syncFitbit();
        Alert.alert(
          "Sync Complete",
          `Steps: ${result.steps ?? "—"}\nCalories: ${result.active_calories ?? "—"}\nHR: ${result.resting_heart_rate_bpm ?? "—"} bpm`
        );
        await load();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? "Sync failed. Please reconnect Fitbit.";
      Alert.alert("Sync Error", msg);
    } finally {
      setActionLoading(null);
    }
  };

  const readiness = scores?.readiness;
  const recovery = scores?.recovery;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#f9fafb" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wearables</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={22} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
      >
        {/* Scores Section */}
        {scores && (
          <View style={styles.scoresSection}>
            <Text style={styles.sectionTitle}>Today's Scores</Text>
            <View style={styles.scoresRow}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreCardLabel}>Readiness</Text>
                {readiness && (
                  <>
                    <View style={[styles.scoreBadge, { backgroundColor: SCORE_COLORS[readiness.label as ScoreLabel] + "20" }]}>
                      <Text style={[styles.scoreBadgeNumber, { color: SCORE_COLORS[readiness.label as ScoreLabel] }]}>
                        {readiness.score}
                      </Text>
                      <Text style={[styles.scoreBadgeLabel, { color: SCORE_COLORS[readiness.label as ScoreLabel] }]}>
                        {readiness.label}
                      </Text>
                    </View>
                    <Text style={styles.scoreAdvice}>{readiness.advice}</Text>
                  </>
                )}
              </View>

              <View style={styles.scoreCard}>
                <Text style={styles.scoreCardLabel}>Recovery</Text>
                {recovery && (
                  <>
                    <View style={[styles.scoreBadge, { backgroundColor: SCORE_COLORS[recovery.label as ScoreLabel] + "20" }]}>
                      <Text style={[styles.scoreBadgeNumber, { color: SCORE_COLORS[recovery.label as ScoreLabel] }]}>
                        {recovery.score}
                      </Text>
                      <Text style={[styles.scoreBadgeLabel, { color: SCORE_COLORS[recovery.label as ScoreLabel] }]}>
                        {recovery.label}
                      </Text>
                    </View>
                    <Text style={styles.scoreAdvice}>{recovery.advice}</Text>
                  </>
                )}
              </View>
            </View>

            {readiness && Object.keys(readiness.factors).length > 0 && (
              <View style={styles.factorsCard}>
                <Text style={styles.factorsTitle}>Readiness Factors</Text>
                {Object.entries(readiness.factors).map(([key, val]) => (
                  <View key={key} style={styles.factorRow}>
                    <Text style={styles.factorKey}>{key.replace(/_/g, " ")}</Text>
                    <Text style={[styles.factorVal, { color: val > 0 ? "#10b981" : val < 0 ? "#ef4444" : "#6b7280" }]}>
                      {val > 0 ? "+" : ""}{val}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Devices Section */}
        <Text style={styles.sectionTitle}>Connected Devices</Text>
        {(["apple_watch", "garmin", "fitbit"] as WearablePlatform[]).map((platform) => (
          <DeviceCard
            key={platform}
            platform={platform}
            connection={getConnection(platform)}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            loading={actionLoading === platform}
          />
        ))}

        <Text style={styles.footerNote}>
          Apple Watch and Garmin connect via Apple Health / Health Connect.{"\n"}
          Fitbit uses direct OAuth for automatic daily sync.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f9fafb" },
  content: { padding: 16, paddingBottom: 32 },

  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, marginTop: 8 },

  scoresSection: { marginBottom: 24 },
  scoresRow: { flexDirection: "row", gap: 12 },
  scoreCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  scoreCardLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: "600" },
  scoreBadge: { borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 8 },
  scoreBadgeNumber: { fontSize: 32, fontWeight: "800", lineHeight: 36 },
  scoreBadgeLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  scoreAdvice: { fontSize: 11, color: "#6b7280", lineHeight: 16 },

  factorsCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  factorsTitle: { fontSize: 12, color: "#6b7280", fontWeight: "600", marginBottom: 8, textTransform: "uppercase" },
  factorRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  factorKey: { fontSize: 13, color: "#d1d5db", textTransform: "capitalize" },
  factorVal: { fontSize: 13, fontWeight: "700" },

  deviceCard: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  deviceHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  deviceIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: "700", color: "#f9fafb" },
  deviceDesc: { fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 17 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  lastSync: { fontSize: 11, color: "#4b5563", marginBottom: 8 },

  deviceActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  connectBtn: { backgroundColor: "#8b5cf6", flex: 1 },
  connectBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  syncBtn: { backgroundColor: "#8b5cf620", borderWidth: 1, borderColor: "#8b5cf6", flex: 1 },
  syncBtnText: { color: "#8b5cf6", fontWeight: "700", fontSize: 14 },
  disconnectBtn: { backgroundColor: "#ef444420", borderWidth: 1, borderColor: "#ef4444", flex: 1 },
  disconnectBtnText: { color: "#ef4444", fontWeight: "700", fontSize: 14 },

  footerNote: { fontSize: 12, color: "#4b5563", textAlign: "center", marginTop: 12, lineHeight: 18 },
});
