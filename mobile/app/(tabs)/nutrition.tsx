import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, CardHeader, CardContent } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Input } from "../../src/components/ui/Input";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { getNutritionLog, createNutritionLog, addFoodEntry, deleteFoodEntry } from "../../src/api/tracking";
import { getTodaySummary } from "../../src/api/analytics";
import { todayISO, formatMacro } from "../../src/lib/utils";
import type { NutritionLog, TodaySummary } from "../../src/types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function NutritionScreen() {
  const [log, setLog] = useState<NutritionLog | null>(null);
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeMeal, setActiveMeal] = useState("breakfast");
  const [saving, setSaving] = useState(false);

  // Food form state
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = todayISO();
      const [todaySummaryData] = await Promise.allSettled([getTodaySummary()]);
      if (todaySummaryData.status === "fulfilled") setSummary(todaySummaryData.value);

      try {
        const logData = await getNutritionLog(today);
        setLog(logData);
      } catch (e: any) {
        if (e?.response?.status === 404) {
          setLog(null);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function ensureLog(): Promise<NutritionLog> {
    if (log) return log;
    const created = await createNutritionLog(todayISO());
    setLog(created);
    return created;
  }

  function openAddFood(mealType: string) {
    setActiveMeal(mealType);
    setFoodName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setFormError("");
    setShowModal(true);
  }

  async function handleAddFood() {
    if (!foodName.trim()) {
      setFormError("Food name is required");
      return;
    }
    setSaving(true);
    try {
      const currentLog = await ensureLog();
      await addFoodEntry(currentLog.id, {
        meal_type: activeMeal,
        food_name: foodName.trim(),
        calories: calories ? Number(calories) : undefined,
        protein_g: protein ? Number(protein) : undefined,
        carbs_g: carbs ? Number(carbs) : undefined,
        fat_g: fat ? Number(fat) : undefined,
      });
      setShowModal(false);
      fetchData(true);
    } catch {
      setFormError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(logId: number, entryId: number) {
    Alert.alert("Remove", "Remove this food entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteFoodEntry(logId, entryId);
          fetchData(true);
        },
      },
    ]);
  }

  const entriesByMeal = (mealType: string) =>
    log?.food_entries.filter((e) => e.meal_type === mealType) ?? [];

  const calTarget = summary?.calories_target;
  const calConsumed = summary?.calories_consumed ?? log?.total_calories ?? 0;
  const calPct = calTarget && calTarget > 0 ? Math.min((calConsumed / calTarget) * 100, 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Nutrition</Text>
        <Text style={styles.todayLabel}>Today</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Calorie Ring / Summary */}
        <Card>
          <CardContent>
            <View style={styles.calSummary}>
              <View style={styles.calMain}>
                <Text style={styles.calValue}>{calConsumed != null ? Math.round(calConsumed) : "—"}</Text>
                <Text style={styles.calLabel}>kcal{calTarget ? ` / ${Math.round(calTarget)}` : ""}</Text>
              </View>
              <View style={styles.macroGrid}>
                {[
                  { label: "Protein", value: summary?.protein_g ?? log?.protein_g, target: summary?.protein_target_g },
                  { label: "Carbs", value: summary?.carbs_g ?? log?.carbs_g, target: summary?.carbs_target_g },
                  { label: "Fat", value: summary?.fat_g ?? log?.fat_g, target: summary?.fat_target_g },
                ].map((m) => (
                  <View key={m.label} style={styles.macroItem}>
                    <Text style={styles.macroValue}>{formatMacro(m.value ?? null)}</Text>
                    <Text style={styles.macroLabel}>{m.label}</Text>
                    {m.target != null && (
                      <Text style={styles.macroTarget}>/ {formatMacro(m.target)}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
            {calTarget != null && calTarget > 0 && (
              <View style={styles.calBar}>
                <View style={[styles.calBarFill, { width: `${calPct}%`, backgroundColor: calPct > 100 ? Colors.error : Colors.primary }]} />
              </View>
            )}
          </CardContent>
        </Card>

        {/* Meal sections */}
        {MEAL_TYPES.map((meal) => {
          const entries = entriesByMeal(meal);
          const mealCal = entries.reduce((s, e) => s + (e.calories ?? 0), 0);
          return (
            <View key={meal}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{MEAL_LABELS[meal]}</Text>
                {mealCal > 0 && <Text style={styles.mealCal}>{Math.round(mealCal)} kcal</Text>}
                <TouchableOpacity onPress={() => openAddFood(meal)} style={styles.mealAddBtn}>
                  <Ionicons name="add" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              {entries.length > 0 ? (
                <Card>
                  {entries.map((entry, i) => (
                    <View key={entry.id} style={[styles.entryRow, i > 0 && styles.entryBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryName}>{entry.food_name}</Text>
                        <Text style={styles.entryMacros}>
                          {[
                            entry.calories ? `${Math.round(entry.calories)} kcal` : null,
                            entry.protein_g ? `P ${formatMacro(entry.protein_g)}` : null,
                            entry.carbs_g ? `C ${formatMacro(entry.carbs_g)}` : null,
                            entry.fat_g ? `F ${formatMacro(entry.fat_g)}` : null,
                          ].filter(Boolean).join("  ·  ")}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => log && handleDeleteEntry(log.id, entry.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </Card>
              ) : (
                <TouchableOpacity onPress={() => openAddFood(meal)} activeOpacity={0.7}>
                  <View style={styles.emptyMeal}>
                    <Ionicons name="add-circle-outline" size={18} color={Colors.textMuted} />
                    <Text style={styles.emptyMealText}>Add {MEAL_LABELS[meal].toLowerCase()}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Add Food Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to {MEAL_LABELS[activeMeal]}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Input
                label="Food Name *"
                placeholder="e.g. Chicken Breast"
                value={foodName}
                onChangeText={(v) => { setFoodName(v); setFormError(""); }}
                autoFocus
                error={formError}
              />
              <Input
                label="Calories (kcal)"
                placeholder="e.g. 250"
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
              />
              <View style={styles.macroRow}>
                <Input
                  label="Protein (g)"
                  placeholder="0"
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Carbs (g)"
                  placeholder="0"
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Fat (g)"
                  placeholder="0"
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />
              </View>
              <Button fullWidth loading={saving} onPress={handleAddFood} size="lg">
                Add Food
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
  todayLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" },

  scroll: { padding: Spacing.md, gap: Spacing.sm },

  calSummary: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  calMain: { alignItems: "center", minWidth: 70 },
  calValue: { fontSize: 28, fontWeight: "800", color: Colors.text },
  calLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  macroGrid: { flex: 1, flexDirection: "row", gap: Spacing.xs },
  macroItem: { flex: 1, alignItems: "center" },
  macroValue: { fontSize: 15, fontWeight: "700", color: Colors.text },
  macroLabel: { fontSize: 10, color: Colors.textMuted, textTransform: "uppercase", marginTop: 1 },
  macroTarget: { fontSize: 10, color: Colors.textMuted },
  calBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, marginTop: Spacing.sm, overflow: "hidden" },
  calBarFill: { height: 6, borderRadius: 3, backgroundColor: Colors.primary },

  mealHeader: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.xs, gap: Spacing.xs },
  mealTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.text },
  mealCal: { fontSize: 12, color: Colors.textMuted },
  mealAddBtn: { padding: 4 },

  entryRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 10 },
  entryBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  entryName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  entryMacros: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  emptyMeal: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  emptyMealText: { fontSize: 13, color: Colors.textMuted },

  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  modalBody: { padding: Spacing.xl, gap: Spacing.md },
  macroRow: { flexDirection: "row", gap: Spacing.sm },
});
