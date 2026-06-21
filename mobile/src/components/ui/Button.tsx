import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Colors, Radius, Spacing } from "../../constants/colors";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      {...props}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}` as keyof typeof styles] as ViewStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "destructive" ? Colors.white : Colors.primary}
        />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}` as keyof typeof styles] as TextStyle, styles[`textSize_${size}` as keyof typeof styles] as TextStyle]}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  fullWidth: { width: "100%" },
  disabled: { opacity: 0.5 },

  // Variants
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.card, borderColor: Colors.border },
  outline: { backgroundColor: "transparent", borderColor: Colors.primary },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  destructive: { backgroundColor: Colors.error },

  // Sizes
  size_sm: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, minHeight: 34 },
  size_md: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, minHeight: 44 },
  size_lg: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 52 },

  // Text
  text: { fontWeight: "600", textAlign: "center" },
  text_primary: { color: Colors.white },
  text_secondary: { color: Colors.text },
  text_outline: { color: Colors.primary },
  text_ghost: { color: Colors.primary },
  text_destructive: { color: Colors.white },

  textSize_sm: { fontSize: 13 },
  textSize_md: { fontSize: 15 },
  textSize_lg: { fontSize: 16 },
});
