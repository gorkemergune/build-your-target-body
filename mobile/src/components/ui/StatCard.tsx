import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "../../constants/colors";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accentColor?: string;
  style?: ViewStyle;
}

export function StatCard({ label, value, sub, accentColor, style }: StatCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accentColor ? { color: accentColor } : null]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 2,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 2,
  },
  sub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
