import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, CardContent } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Input } from "../../src/components/ui/Input";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { getWorkouts, createWorkout, deleteWorkout } from "../../src/api/tracking";
import { todayISO, formatRelativeDate } from "../../src/lib/utils";
import type { Workout, WorkoutType } from "../../src/types";

const WORKOUT_TYPES: { value: WorkoutType; label: string; icon: string }[] = [
  { value: "strength", label: "Strength", icon: "barbell" },
  { value: "cardio", label: "Cardio", icon: "flame" },
  { value: "running", label: "Running", icon: "walk" },
  { value: "cycling", label: "Cycling", icon: "bicycle" },
  { value: "pilates", label: "Pilates", icon: "body" },
  { value: "crossfit", label: "CrossFit", icon: "timer" },
];

function WorkoutTypeBadge({ type }: { type: WorkoutType }) {
  const config = WORKOUT_TYPES.find((t) => t.value === type) ?? WORKOUT_TYPES[0];
  return (
    <View style={styles.typeBadge}>
      <Ionicons name={config.icon as any} size={12} color={Colors.primary} />
      <Text style={styles.typeBadgeText}>{config.label}</Text>
    </View>
  );
}

export default function WorkoutsScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Form
  const [workoutName, setWorkoutName] = useState("");
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getWorkouts(20);
      setWorkouts(data);
    } catch { } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openModal() {
    setWorkoutName("");
    setWorkoutType("strength");
    setDuration("");
    setNotes("");
    setFormError("");
    setShowModal(true);
  }

  async function handleCreate() {
    if (!workoutName.trim()) { setFormError("Workout name is required"); return; }
    setSaving(true);
    try {
      await createWorkout({
        name: workoutName.trim(),
        workout_type: workoutType,
        logged_at: todayISO(),
        duration_minutes: duration ? parseInt(duration) : undefined,
        notes: notes.trim() || undefined,
        exercises: [],
      });
      setShowModal(false);
      fetchData(true);
    } catch {
      setFormError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    Alert.alert("Delete Workout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteWorkout(id);
            setWorkouts((w) => w.filter((x) => x.id !== id));
          } catch {
            Alert.alert("Error", "Failed to delete.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Workouts</Text>
        <TouchableOpacity onPress={openModal} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {workouts.length === 0 && !loading ? (
          <EmptyState
            icon="barbell"
            title="No workouts logged"
            subtitle="Tap + to log your first workout"
            actionLabel="Log Workout"
            onAction={openModal}
          />
        ) : (
          workouts.map((w) => (
            <Card key={w.id} style={styles.workoutCard}>
              <CardContent>
                <TouchableOpacity onPress={() => setExpanded(expanded === w.id ? null : w.id)} activeOpacity={0.7}>
                  <View style={styles.workoutHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workoutName}>{w.name}</Text>
                      <View style={styles.workoutMeta}>
                        <WorkoutTypeBadge type={w.workout_type} />
                        <Text style={styles.workoutDate}>{formatRelativeDate(w.logged_at)}</Text>
                        {w.duration_minutes != null && (
                          <Text style={styles.workoutDuration}>{w.duration_minutes} min</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.workoutActions}>
                      <TouchableOpacity onPress={() => handleDelete(w.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                      <Ionicons name={expanded === w.id ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Stats row */}
                {(w.total_volume_kg || w.total_sets || w.total_reps) && (
                  <View style={styles.statsRow}>
                    {w.total_volume_kg != null && w.total_volume_kg > 0 && (
                      <View style={styles.statChip}><Text style={styles.statChipText}>{w.total_volume_kg.toLocaleString()} kg</Text></View>
                    )}
                    {w.total_sets != null && w.total_sets > 0 && (
                      <View style={styles.statChip}><Text style={styles.statChipText}>{w.total_sets} sets</Text></View>
                    )}
                    {w.total_reps != null && w.total_reps > 0 && (
                      <View style={styles.statChip}><Text style={styles.statChipText}>{w.total_reps} reps</Text></View>
                    )}
                  </View>
                )}

                {/* Exercises */}
                {expanded === w.id && w.exercises.length > 0 && (
                  <View style={styles.exerciseList}>
                    {w.exercises.map((ex) => (
                      <View key={ex.id} style={styles.exerciseItem}>
                        <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
                        {ex.workout_sets.length > 0 && (
                          <View style={styles.setList}>
                            {ex.workout_sets.map((s) => (
                              <Text key={s.id} style={[styles.setItem, s.set_type === "warmup" && styles.setWarmup]}>
                                {s.set_type === "warmup" ? "W" : s.set_number}
                                {s.weight_kg != null ? ` · ${s.weight_kg}kg` : ""}
                                {s.reps != null ? ` × ${s.reps}` : ""}
                                {s.rpe != null ? ` @${s.rpe}` : ""}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </CardContent>
            </Card>
          ))
        )}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Log Workout Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Workout</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Input
                label="Workout Name *"
                placeholder="e.g. Upper Body Day"
                value={workoutName}
                onChangeText={(v) => { setWorkoutName(v); setFormError(""); }}
                autoFocus
                error={formError}
              />

              {/* Type picker */}
              <View>
                <Text style={styles.typeLabel}>Workout Type</Text>
                <View style={styles.typeGrid}>
                  {WORKOUT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setWorkoutType(t.value)}
                      style={[styles.typeBtn, workoutType === t.value && styles.typeBtnActive]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={t.icon as any} size={18} color={workoutType === t.value ? Colors.white : Colors.textSecondary} />
                      <Text style={[styles.typeBtnText, workoutType === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                label="Duration (minutes)"
                placeholder="e.g. 60"
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
              />
              <Input
                label="Notes (optional)"
                placeholder="How did it feel?"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: "top", paddingTop: 10 }}
              />
              <Button fullWidth loading={saving} onPress={handleCreate} size="lg">
                Save Workout
              </Button>
            </ScrollView>
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

  scroll: { padding: Spacing.md, gap: Spacing.sm },

  workoutCard: { marginBottom: 0 },
  workoutHeader: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  workoutName: { fontSize: 16, fontWeight: "700", color: Colors.text },
  workoutMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: 4, flexWrap: "wrap" },
  workoutDate: { fontSize: 12, color: Colors.textMuted },
  workoutDuration: { fontSize: 12, color: Colors.textMuted },
  workoutActions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingTop: 2 },

  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontSize: 11, fontWeight: "600", color: Colors.primary },

  statsRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.sm, flexWrap: "wrap" },
  statChip: { backgroundColor: Colors.card, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statChipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },

  exerciseList: { marginTop: Spacing.sm, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  exerciseItem: { gap: 4 },
  exerciseName: { fontSize: 13, fontWeight: "600", color: Colors.text },
  setList: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  setItem: { fontSize: 11, color: Colors.textSecondary, backgroundColor: Colors.card, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  setWarmup: { backgroundColor: "#fef3c7", color: "#92400e" },

  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  modalBody: { padding: Spacing.xl, gap: Spacing.md },

  typeLabel: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  typeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  typeBtnTextActive: { color: Colors.white },
});
