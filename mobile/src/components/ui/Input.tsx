import React, { forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { Colors, Radius, Spacing } from "../../constants/colors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  hint?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, containerStyle, hint, style, ...props }, ref) => {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TextInput
          ref={ref}
          style={[styles.input, error ? styles.inputError : null, style]}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          {...props}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  inputError: { borderColor: Colors.error },
  error: { fontSize: 12, color: Colors.error },
  hint: { fontSize: 12, color: Colors.textMuted },
});
