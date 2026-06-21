import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, CardHeader, CardContent } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Input } from "../../src/components/ui/Input";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { getWeightLogs, logWeight, deleteWeight } from "../../src/api/tracking";
import { getWeightTrend } from "../../src/api/analytics";
import { formatDate, todayISO } from "../../src/lib/utils";
import type { WeightLog } from "../../src/types";

export default function WeightScreen() {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [weightError, setWeightError] = useState("");
  const [trend, setTrend] = useState<{ date: string; value: number }[]>([]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [logs, trend] = await Promise.all([
        getWeightLogs(30),
        getWeightTrend(30),
      ]);
      setLogs(logs);
      setTrend(trend);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleLog() {
    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) {
      setWeightError("Enter a valid weight");
      return;
    }
    setSaving(true);
    try {
      await logWeight(Number(weight), todayISO(), notes.trim() || undefined);
      setWeight("");
      setNotes("");
      setShowModal(false);
      fetchData(true);
    } catch {
      setWeightError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    Alert.alert("Delete Entry", "Are you sure you want to delete this weight log?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteWeight(id);
            setLogs((l) => l.filter((x) => x.id !== id));
          } catch {
            Alert.alert("Error", "Failed to delete.");
          }
        },
      },
    ]);
  }

  // Compute stats
  const latest = logs[0];
  const previous = logs[1];
  const change = latest && previous ? latest.weight_kg - previous.weight_kg : null;

  // Simple sparkline (text-based trend indicator)
  const trendPts = trend.slice(-7);
  const trendDir = trendPts.length >= 2
    ? trendPts[trendPts.length - 1].value - trendPts[0].value
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Weight Tracking</Text>
        <TouchableOpacity onPress={() => { setShowModal(true); setWeightError(""); }} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary cards */}
        {latest && (
          <View style={styles.statRow}>
            <Card style={styles.statCard}>
              <CardContent style={styles.statContent}>
                <Text style={styles.statLabel}>Current</Text>
                <Text style={styles.statValue}>{latest.weight_kg} kg</Text>
                <Text style={styles.statSub}>{formatDate(latest.logged_at)}</Text>
              </CardContent>
            </Card>
            {change !== null && (
              <Card style={styles.statCard}>
                <CardContent style={styles.statContent}>
                  <Text style={styles.statLabel}>Change</Text>
                  <Text style={[styles.statValue, { color: change < 0 ? Colors.success : change > 0 ? Colors.error : Colors.text }]}>
                    {change > 0 ? "+" : ""}{change.toFixed(1)} kg
                  </Text>
                  <Text style={styles.statSub}>vs previous</Text>
                </CardContent>
              </Card>
            )}
            {trendDir !== null && (
              <Card style={styles.statCard}>
                <CardContent style={styles.statContent}>
                  <Text style={styles.statLabel}>7-Day Trend</Text>
                  <Ionicons
                    name={trendDir < -0.2 ? "trending-down" : trendDir > 0.2 ? "trending-up" : "remove"}
                    size={28}
                    color={trendDir < -0.2 ? Colors.success : trendDir > 0.2 ? Colors.error : Colors.textMuted}
                  />
                  <Text style={styles.statSub}>{trendDir >= 0 ? "+" : ""}{trendDir.toFixed(1)} kg</Text>
                </CardContent>
              </Card>
            )}
          </View>
        )}

        {/* History */}
        <Text style={styles.sectionTitle}>History</Text>
        {logs.length === 0 ? (
          <EmptyState
            icon="scale"
            title="No weight logs yet"
            subtitle="Tap + to log your first weight entry"
            actionLabel="Log Weight"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <Card>
            {logs.map((log, i) => (
              <View key={log.id} style={[styles.logRow, i > 0 && styles.logBorder]}>
                <View style={styles.logLeft}>
                  <Text style={styles.logWeight}>{log.weight_kg} kg</Text>
                  {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.logDate}>{formatDate(log.logged_at)}</Text>
                  <TouchableOpacity onPress={() => handleDelete(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>
        )}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Add Weight Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Weight</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Input
                label="Weight (kg)"
                placeholder="e.g. 75.5"
                value={weight}
                onChangeText={(v) => { setWeight(v); setWeightError(""); }}
                keyboardType="decimal-pad"
                autoFocus
                error={weightError}
              />
              <Input
                label="Notes (optional)"
                placeholder="Morning, after workout, etc."
                value={notes}
                onChangeText={setNotes}
              />
              <Button fullWidth loading={saving} onPress={handleLog} size="lg">
                Save Weight
              </Button>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.card },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "800", color: Colors.text },
  addBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },

  scroll: { padding: Spacing.md, gap: Spacing.md },

  statRow: { flexDirection: "row", gap: Spacing.sm },
  statCard: { flex: 1 },
  statContent: { alignItems: "center", paddingVertical: Spacing.sm },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase" },
  statValue: { fontSize: 22, fontWeight: "800", color: Colors.text, marginTop: 4 },
  statSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },

  logRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 12 },
  logBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  logLeft: { flex: 1 },
  logWeight: { fontSize: 16, fontWeight: "700", color: Colors.text },
  logNotes: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  logRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  logDate: { fontSize: 13, color: Colors.textMuted },

  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  modalBody: { padding: Spacing.xl, gap: Spacing.md },
});
