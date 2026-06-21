import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, CardContent } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Input } from "../../src/components/ui/Input";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { useAuthStore } from "../../src/stores/auth";
import { useRemindersStore } from "../../src/stores/reminders";
import { useHealthStore } from "../../src/stores/health";
import { useWearableStore } from "../../src/stores/wearable";
import { updateProfile } from "../../src/api/auth";
import type { User } from "../../src/types";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
  { value: "lightly_active", label: "Lightly Active", desc: "1-3 days/week" },
  { value: "moderately_active", label: "Moderately Active", desc: "3-5 days/week" },
  { value: "very_active", label: "Very Active", desc: "6-7 days/week" },
  { value: "extra_active", label: "Extra Active", desc: "Twice a day" },
];

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function InfoRow({ label, value, icon }: { label: string; value: string | null | undefined; icon: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon as any} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value ?? "Not set"}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuthStore();
  const enabledCount = useRemindersStore((s) => s.reminders.filter((r) => r.enabled).length);
  const healthConnected = useHealthStore((s) => s.isConnected);
  const healthSource = useHealthStore((s) => s.source);
  const wearableCount = useWearableStore((s) => s.connectedCount());
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activityModal, setActivityModal] = useState(false);

  // Edit form state — synced from user on open
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [heightCm, setHeightCm] = useState(user?.height_cm?.toString() ?? "");
  const [gender, setGender] = useState<string>(user?.gender ?? "");
  const [activityLevel, setActivityLevel] = useState<string>(user?.activity_level ?? "");
  const [language, setLanguage] = useState(user?.preferred_language ?? "en");
  const [formError, setFormError] = useState("");

  function openEdit() {
    setFullName(user?.full_name ?? "");
    setHeightCm(user?.height_cm?.toString() ?? "");
    setGender(user?.gender ?? "");
    setActivityLevel(user?.activity_level ?? "");
    setLanguage(user?.preferred_language ?? "en");
    setFormError("");
    setEditMode(true);
  }

  async function handleSave() {
    if (!fullName.trim()) { setFormError("Name is required"); return; }
    setSaving(true);
    try {
      const updated = await updateProfile({
        full_name: fullName.trim(),
        height_cm: heightCm ? parseFloat(heightCm) : undefined,
        gender: gender || undefined,
        activity_level: activityLevel || undefined,
        preferred_language: language,
      });
      setUser(updated);
      setEditMode(false);
    } catch {
      setFormError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  }

  const activityLabel = ACTIVITY_LEVELS.find((a) => a.value === (user?.activity_level ?? ""))?.label ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Profile</Text>
        {!editMode && (
          <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color={Colors.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar block */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {user?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.full_name ?? "—"}</Text>
          <Text style={styles.userEmail}>{user?.email ?? "—"}</Text>
        </View>

        {!editMode ? (
          <>
            {/* Profile info card */}
            <Card>
              <CardContent style={{ gap: 0 }}>
                <InfoRow label="Height" value={user?.height_cm ? `${user.height_cm} cm` : null} icon="body" />
                <View style={styles.divider} />
                <InfoRow label="Gender" value={user?.gender ? GENDERS.find(g => g.value === user.gender)?.label : null} icon="person" />
                <View style={styles.divider} />
                <InfoRow label="Activity Level" value={activityLabel} icon="fitness" />
                <View style={styles.divider} />
                <InfoRow label="Language" value={user?.preferred_language === "tr" ? "Türkçe" : "English"} icon="language" />
                <View style={styles.divider} />
                <InfoRow label="Member Since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : null} icon="calendar" />
              </CardContent>
            </Card>

            {/* Health Sync */}
            <TouchableOpacity onPress={() => router.push("/health-sync")} activeOpacity={0.7}>
              <Card>
                <CardContent>
                  <View style={styles.settingsRow}>
                    <View style={[styles.settingsIcon, { backgroundColor: "#fee2e2" }]}>
                      <Ionicons name="heart-circle-outline" size={18} color="#ef4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsLabel}>Health Sync</Text>
                      <Text style={styles.settingsSub}>
                        {healthConnected
                          ? `Connected to ${healthSource === "apple_health" ? "Apple Health" : "Health Connect"}`
                          : "Not connected"}
                      </Text>
                    </View>
                    {healthConnected && <View style={styles.connectedDot} />}
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>

            {/* Wearables */}
            <TouchableOpacity onPress={() => router.push("/wearables")} activeOpacity={0.7}>
              <Card>
                <CardContent>
                  <View style={styles.settingsRow}>
                    <View style={[styles.settingsIcon, { backgroundColor: "#dbeafe" }]}>
                      <Ionicons name="watch-outline" size={18} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsLabel}>Wearables</Text>
                      <Text style={styles.settingsSub}>
                        {wearableCount > 0 ? `${wearableCount} device${wearableCount > 1 ? "s" : ""} connected` : "No devices connected"}
                      </Text>
                    </View>
                    {wearableCount > 0 && <View style={styles.connectedDot} />}
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>

            {/* Reminders */}
            <TouchableOpacity onPress={() => router.push("/reminders")} activeOpacity={0.7}>
              <Card>
                <CardContent>
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsIcon}>
                      <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsLabel}>Reminders</Text>
                      <Text style={styles.settingsSub}>
                        {enabledCount > 0 ? `${enabledCount} active reminder${enabledCount > 1 ? "s" : ""}` : "No active reminders"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>

            {/* Logout */}
            <Button variant="destructive" fullWidth onPress={handleLogout}>
              Log Out
            </Button>
          </>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Card>
              <CardContent style={{ gap: Spacing.md }}>
                <Input
                  label="Full Name *"
                  placeholder="Your name"
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); setFormError(""); }}
                  autoFocus
                  error={formError}
                />
                <Input
                  label="Height (cm)"
                  placeholder="e.g. 178"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="numeric"
                />

                {/* Gender */}
                <View>
                  <Text style={styles.fieldLabel}>Gender</Text>
                  <View style={styles.chipRow}>
                    {GENDERS.map((g) => (
                      <TouchableOpacity
                        key={g.value}
                        onPress={() => setGender(gender === g.value ? "" : g.value)}
                        style={[styles.chip, gender === g.value && styles.chipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, gender === g.value && styles.chipTextActive]}>{g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Activity level */}
                <View>
                  <Text style={styles.fieldLabel}>Activity Level</Text>
                  <TouchableOpacity onPress={() => setActivityModal(true)} style={styles.selector} activeOpacity={0.7}>
                    <Text style={[styles.selectorText, !activityLevel && styles.selectorPlaceholder]}>
                      {activityLevel ? ACTIVITY_LEVELS.find((a) => a.value === activityLevel)?.label : "Select activity level"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Language */}
                <View>
                  <Text style={styles.fieldLabel}>Language</Text>
                  <View style={styles.chipRow}>
                    {[{ value: "en", label: "English" }, { value: "tr", label: "Türkçe" }].map((l) => (
                      <TouchableOpacity
                        key={l.value}
                        onPress={() => setLanguage(l.value)}
                        style={[styles.chip, language === l.value && styles.chipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, language === l.value && styles.chipTextActive]}>{l.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.editBtns}>
                  <Button variant="outline" onPress={() => setEditMode(false)} style={{ flex: 1 }}>Cancel</Button>
                  <Button loading={saving} onPress={handleSave} style={{ flex: 1 }}>Save</Button>
                </View>
              </CardContent>
            </Card>
          </KeyboardAvoidingView>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Activity Level Picker Modal */}
      <Modal visible={activityModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActivityModal(false)}>
        <SafeAreaView style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Activity Level</Text>
            <TouchableOpacity onPress={() => setActivityModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.pickerBody}>
            {ACTIVITY_LEVELS.map((a) => (
              <TouchableOpacity
                key={a.value}
                onPress={() => { setActivityLevel(a.value); setActivityModal(false); }}
                style={[styles.pickerRow, activityLevel === a.value && styles.pickerRowActive]}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerRowLabel, activityLevel === a.value && styles.pickerRowLabelActive]}>{a.label}</Text>
                  <Text style={styles.pickerRowDesc}>{a.desc}</Text>
                </View>
                {activityLevel === a.value && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.card },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "800", color: Colors.text },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary },
  editBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  scroll: { padding: Spacing.md, gap: Spacing.md },

  avatarSection: { alignItems: "center", paddingVertical: Spacing.lg },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  avatarInitials: { fontSize: 28, fontWeight: "800", color: Colors.white },
  userName: { fontSize: 20, fontWeight: "800", color: Colors.text },
  userEmail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  infoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm + 2 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  infoValue: { fontSize: 15, fontWeight: "600", color: Colors.text, marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 44 },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },

  selector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  selectorText: { fontSize: 15, color: Colors.text },
  selectorPlaceholder: { color: Colors.textMuted },

  settingsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  settingsIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  settingsLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
  settingsSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },

  editBtns: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },

  pickerModal: { flex: 1, backgroundColor: Colors.white },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  pickerBody: { padding: Spacing.md, gap: Spacing.xs },
  pickerRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  pickerRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + "50" },
  pickerRowLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
  pickerRowLabelActive: { color: Colors.primary },
  pickerRowDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
