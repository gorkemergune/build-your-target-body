import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity,
  Alert, Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors, Spacing, Radius } from "../src/constants/colors";
import { Card, CardContent } from "../src/components/ui/Card";
import { Button } from "../src/components/ui/Button";
import { useRemindersStore } from "../src/stores/reminders";
import type { ReminderConfig, ReminderFrequency, ReminderType } from "../src/stores/reminders";
import {
  requestNotificationPermissions,
  getPermissionStatus,
  rescheduleReminder,
  cancelReminder,
} from "../src/services/notifications";
import { getSmartReminders } from "../src/api/ai";
import { getDashboard, getTodaySummary } from "../src/api/analytics";

// ── Metadata ──────────────────────────────────────────────────────────────────

const REMINDER_META: Record<ReminderType, { label: string; emoji: string; desc: string }> = {
  weight: { label: "Weight Log", emoji: "📊", desc: "Daily check-in to log your weight" },
  workout: { label: "Workout", emoji: "💪", desc: "Get motivated to hit the gym" },
  water: { label: "Water", emoji: "💧", desc: "Hydration reminders throughout the day" },
  protein: { label: "Protein", emoji: "🥩", desc: "Hit your daily protein target" },
  goal: { label: "Goal Progress", emoji: "🎯", desc: "Stay focused on your transformation" },
};

const FREQUENCY_OPTIONS: { value: ReminderFrequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
];

const ORDER: ReminderType[] = ["weight", "workout", "water", "protein", "goal"];

// ── Time Picker Modal ─────────────────────────────────────────────────────────

interface TimePickerModalProps {
  visible: boolean;
  hour: number;
  minute: number;
  frequency: ReminderFrequency;
  onConfirm: (h: number, m: number, f: ReminderFrequency) => void;
  onClose: () => void;
}

function TimePickerModal({ visible, hour, minute, frequency, onConfirm, onClose }: TimePickerModalProps) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  const [freq, setFreq] = useState(frequency);

  useEffect(() => {
    if (visible) { setH(hour); setM(minute); setFreq(frequency); }
  }, [visible, hour, minute, frequency]);

  function stepHour(delta: number) { setH((v) => (v + delta + 24) % 24); }
  function stepMinute(delta: number) { setM((v) => (v + delta + 60) % 60); }

  const fmt = (n: number) => String(n).padStart(2, "0");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <View style={tp.sheet}>
          <Text style={tp.title}>Set Reminder Time</Text>

          {/* Time selector */}
          <View style={tp.timeRow}>
            <View style={tp.spinnerCol}>
              <TouchableOpacity onPress={() => stepHour(1)} style={tp.arrow}>
                <Ionicons name="chevron-up" size={22} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={tp.timeValue}>{fmt(h)}</Text>
              <TouchableOpacity onPress={() => stepHour(-1)} style={tp.arrow}>
                <Ionicons name="chevron-down" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={tp.timeSep}>:</Text>
            <View style={tp.spinnerCol}>
              <TouchableOpacity onPress={() => stepMinute(5)} style={tp.arrow}>
                <Ionicons name="chevron-up" size={22} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={tp.timeValue}>{fmt(m)}</Text>
              <TouchableOpacity onPress={() => stepMinute(-5)} style={tp.arrow}>
                <Ionicons name="chevron-down" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Frequency */}
          <Text style={tp.freqLabel}>Frequency</Text>
          <View style={tp.freqRow}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setFreq(opt.value)}
                style={[tp.freqBtn, freq === opt.value && tp.freqBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[tp.freqBtnText, freq === opt.value && tp.freqBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={tp.actions}>
            <Button variant="outline" onPress={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button onPress={() => onConfirm(h, m, freq)} style={{ flex: 1 }}>Save</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Reminder Card ─────────────────────────────────────────────────────────────

interface ReminderCardProps {
  reminder: ReminderConfig;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
}

function ReminderCard({ reminder, onToggle, onEdit }: ReminderCardProps) {
  const meta = REMINDER_META[reminder.type];
  const freq = FREQUENCY_OPTIONS.find((f) => f.value === reminder.frequency)?.label ?? "Every day";
  const timeStr = `${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}`;

  return (
    <Card style={[styles.reminderCard, reminder.enabled && styles.reminderCardActive]}>
      <CardContent>
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <View style={[styles.emojiCircle, reminder.enabled && styles.emojiCircleActive]}>
              <Text style={styles.emoji}>{meta.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{meta.label}</Text>
              <Text style={styles.cardDesc}>{meta.desc}</Text>
            </View>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={onToggle}
            trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
            thumbColor={reminder.enabled ? Colors.primary : Colors.textMuted}
          />
        </View>

        {reminder.enabled && (
          <TouchableOpacity onPress={onEdit} style={styles.scheduleRow} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.scheduleText}>{freq} at {timeStr}</Text>
            {reminder.aiMessage && (
              <View style={styles.aiTag}>
                <Ionicons name="sparkles" size={10} color={Colors.primary} />
                <Text style={styles.aiTagText}>AI</Text>
              </View>
            )}
            <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        )}

        {reminder.enabled && reminder.aiMessage && (
          <View style={styles.previewBox}>
            <Text style={styles.previewText} numberOfLines={2}>{reminder.aiMessage}</Text>
          </View>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function RemindersScreen() {
  const { reminders, analytics, permissionGranted, setPermissionGranted, updateReminder } =
    useRemindersStore();

  const [editingType, setEditingType] = useState<ReminderType | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [permStatus, setPermStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");

  const checkPermission = useCallback(async () => {
    const status = await getPermissionStatus();
    setPermStatus(status);
    setPermissionGranted(status === "granted");
  }, [setPermissionGranted]);

  useEffect(() => { checkPermission(); }, [checkPermission]);

  async function handleRequestPermission() {
    const granted = await requestNotificationPermissions();
    const status = granted ? "granted" : "denied";
    setPermStatus(status);
    setPermissionGranted(granted);
  }

  async function handleToggle(type: ReminderType, enabled: boolean) {
    if (enabled && permStatus !== "granted") {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "Please enable notifications in your device settings to use reminders.",
          [{ text: "OK" }]
        );
        return;
      }
      setPermStatus("granted");
      setPermissionGranted(true);
    }

    const reminder = reminders.find((r) => r.type === type)!;
    const updatedReminder = { ...reminder, enabled };

    // Cancel old notifications
    if (!enabled && reminder.notificationIds.length > 0) {
      await cancelReminder(reminder.notificationIds);
    }

    let newIds: string[] = reminder.notificationIds;
    if (enabled) {
      try {
        newIds = await rescheduleReminder(updatedReminder);
      } catch {
        Alert.alert("Error", "Failed to schedule reminder. Check notification permissions.");
        return;
      }
    } else {
      newIds = [];
    }

    updateReminder(type, { enabled, notificationIds: newIds });
  }

  async function handleTimeConfirm(type: ReminderType, h: number, m: number, freq: ReminderFrequency) {
    setEditingType(null);
    const reminder = reminders.find((r) => r.type === type)!;
    const updated = { ...reminder, hour: h, minute: m, frequency: freq };

    try {
      const ids = await rescheduleReminder(updated);
      updateReminder(type, { hour: h, minute: m, frequency: freq, notificationIds: ids });
    } catch {
      Alert.alert("Error", "Failed to reschedule reminder.");
    }
  }

  async function handleAiRefresh() {
    if (permStatus !== "granted") {
      Alert.alert("Enable Notifications First", "Turn on at least one reminder before generating AI messages.");
      return;
    }

    const enabledTypes = reminders.filter((r) => r.enabled).map((r) => r.type);
    if (enabledTypes.length === 0) {
      Alert.alert("No Active Reminders", "Enable at least one reminder to generate AI messages.");
      return;
    }

    setAiLoading(true);
    try {
      // Fetch user context for personalization
      const [dashboard, todaySummary] = await Promise.allSettled([getDashboard(), getTodaySummary()]);

      const dash = dashboard.status === "fulfilled" ? dashboard.value : null;
      const today = todaySummary.status === "fulfilled" ? todaySummary.value : null;

      const messages = await getSmartReminders({
        reminder_types: enabledTypes,
        calories_today: today?.calories_consumed ?? null,
        protein_today_g: today?.protein_g ?? null,
        protein_target_g: today?.protein_target_g ?? null,
        workouts_this_week: dash?.workouts_this_week ?? null,
        last_weight_kg: dash?.latest_weight_kg ?? null,
        goal_type: dash?.active_goal?.goal_type ?? null,
        goal_progress_pct: dash?.active_goal?.progress_pct ?? null,
      });

      // Apply messages and reschedule with new content
      for (const type of enabledTypes) {
        const aiMessage = messages[type] ?? null;
        if (aiMessage) {
          const reminder = reminders.find((r) => r.type === type)!;
          const updated = { ...reminder, aiMessage };
          const ids = await rescheduleReminder(updated);
          updateReminder(type, { aiMessage, notificationIds: ids });
        }
      }

      Alert.alert("Done!", "AI has personalized your reminders based on today's data.");
    } catch {
      Alert.alert("Error", "Could not generate AI messages. Default messages will be used.");
    } finally {
      setAiLoading(false);
    }
  }

  const editingReminder = editingType ? reminders.find((r) => r.type === editingType) : null;
  const totalOpens = Object.values(analytics).reduce((sum, s) => sum + s.opens, 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reminders</Text>
        <TouchableOpacity onPress={handleAiRefresh} disabled={aiLoading} style={styles.aiBtn}>
          {aiLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="sparkles" size={14} color={Colors.primary} />
              <Text style={styles.aiBtnText}>AI Refresh</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Permission banner */}
        {permStatus !== "granted" && (
          <TouchableOpacity onPress={handleRequestPermission} style={styles.permBanner} activeOpacity={0.8}>
            <Ionicons name="notifications-off-outline" size={20} color="#92400e" />
            <View style={{ flex: 1 }}>
              <Text style={styles.permTitle}>Notifications are off</Text>
              <Text style={styles.permSub}>Tap to enable push notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#92400e" />
          </TouchableOpacity>
        )}

        {/* AI Refresh info */}
        <View style={styles.aiHint}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.aiHintText}>
            Tap <Text style={{ fontWeight: "700" }}>AI Refresh</Text> to personalize reminder messages using today's nutrition, workout, and goal data.
          </Text>
        </View>

        {/* Reminder cards */}
        <Text style={styles.sectionTitle}>Your Reminders</Text>
        {ORDER.map((type) => {
          const reminder = reminders.find((r) => r.type === type)!;
          return (
            <ReminderCard
              key={type}
              reminder={reminder}
              onToggle={(enabled) => handleToggle(type, enabled)}
              onEdit={() => setEditingType(type)}
            />
          );
        })}

        {/* Analytics */}
        <Text style={styles.sectionTitle}>Notification Activity</Text>
        <Card>
          <CardContent>
            {totalOpens === 0 ? (
              <Text style={styles.noActivity}>No notification activity yet</Text>
            ) : (
              ORDER.filter((t) => analytics[t]?.opens > 0).map((type, i, arr) => {
                const stat = analytics[type];
                const meta = REMINDER_META[type];
                return (
                  <View key={type} style={[styles.analyticsRow, i < arr.length - 1 && styles.analyticsBorder]}>
                    <Text style={styles.analyticsEmoji}>{meta.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.analyticsLabel}>{meta.label}</Text>
                      {stat.lastOpened && (
                        <Text style={styles.analyticsDate}>
                          Last opened: {new Date(stat.lastOpened).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.opensBadge}>
                      <Text style={styles.opensCount}>{stat.opens}</Text>
                      <Text style={styles.opensLabel}>opens</Text>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Time picker modal */}
      {editingReminder && (
        <TimePickerModal
          visible={!!editingType}
          hour={editingReminder.hour}
          minute={editingReminder.minute}
          frequency={editingReminder.frequency}
          onConfirm={(h, m, f) => handleTimeConfirm(editingType!, h, m, f)}
          onClose={() => setEditingType(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.card },

  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: Colors.text, marginLeft: Spacing.sm },
  aiBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary,
    minWidth: 90, justifyContent: "center",
  },
  aiBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  scroll: { padding: Spacing.md, gap: Spacing.sm },

  permBanner: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    backgroundColor: "#fef3c7", borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: "#fcd34d",
  },
  permTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  permSub: { fontSize: 12, color: "#92400e", marginTop: 1 },

  aiHint: {
    flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs,
    backgroundColor: Colors.primaryLight + "80", borderRadius: Radius.md,
    padding: Spacing.sm + 2,
  },
  aiHintText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginTop: Spacing.xs },

  reminderCard: { marginBottom: 0 },
  reminderCardActive: { borderWidth: 1.5, borderColor: Colors.primary + "40" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  emojiCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.card, alignItems: "center", justifyContent: "center",
  },
  emojiCircleActive: { backgroundColor: Colors.primaryLight },
  emoji: { fontSize: 20 },
  cardLabel: { fontSize: 15, fontWeight: "700", color: Colors.text },
  cardDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  scheduleRow: {
    flexDirection: "row", alignItems: "center", gap: Spacing.xs,
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  scheduleText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  aiTag: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  aiTagText: { fontSize: 10, fontWeight: "700", color: Colors.primary },

  previewBox: {
    marginTop: Spacing.xs, backgroundColor: Colors.card,
    borderRadius: Radius.sm, padding: Spacing.xs + 2,
  },
  previewText: { fontSize: 12, color: Colors.textSecondary, fontStyle: "italic" },

  noActivity: { fontSize: 14, color: Colors.textMuted, textAlign: "center", paddingVertical: Spacing.md },
  analyticsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm },
  analyticsBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  analyticsEmoji: { fontSize: 22, width: 32, textAlign: "center" },
  analyticsLabel: { fontSize: 14, fontWeight: "600", color: Colors.text },
  analyticsDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  opensBadge: { alignItems: "center" },
  opensCount: { fontSize: 20, fontWeight: "800", color: Colors.primary },
  opensLabel: { fontSize: 10, color: Colors.textMuted },
});

// ── Time Picker Styles ────────────────────────────────────────────────────────

const tp = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  sheet: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.xl, width: "85%", gap: Spacing.md,
  },
  title: { fontSize: 17, fontWeight: "800", color: Colors.text, textAlign: "center" },

  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md },
  spinnerCol: { alignItems: "center", gap: Spacing.xs },
  arrow: { padding: Spacing.xs, borderRadius: Radius.md, backgroundColor: Colors.primaryLight },
  timeValue: { fontSize: 40, fontWeight: "800", color: Colors.text, width: 62, textAlign: "center" },
  timeSep: { fontSize: 36, fontWeight: "800", color: Colors.text, marginBottom: 4 },

  freqLabel: { fontSize: 13, fontWeight: "600", color: Colors.text },
  freqRow: { flexDirection: "row", gap: Spacing.xs },
  freqBtn: {
    flex: 1, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center",
  },
  freqBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  freqBtnText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  freqBtnTextActive: { color: Colors.primary },

  actions: { flexDirection: "row", gap: Spacing.sm },
});
