import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { register } from "../../src/api/auth";
import { useAuthStore } from "../../src/stores/auth";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { login: storeLogin } = useAuthStore();

  function validate() {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!email.includes("@")) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) e.confirmPassword = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const tokens = await register(email.trim().toLowerCase(), password, fullName.trim());
      await storeLogin(tokens.access_token, tokens.refresh_token);
      router.replace("/(tabs)");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string" && detail.toLowerCase().includes("email")) {
        setErrors({ email: "An account with this email already exists." });
      } else {
        setErrors({ general: "Registration failed. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Create account</Text>
            <Text style={styles.formSubtitle}>Start your transformation today</Text>

            {errors.general && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </View>
            )}

            <Input
              label="Full Name"
              placeholder="John Doe"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              autoCapitalize="words"
              error={errors.fullName}
            />

            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
            />

            <View>
              <Input
                label="Password"
                placeholder="Min. 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                error={errors.password}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Input
              label="Confirm Password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              error={errors.confirmPassword}
            />

            <Button fullWidth loading={loading} onPress={handleRegister} size="lg" style={styles.registerBtn}>
              Create Account
            </Button>

            <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Text style={styles.loginTextBold}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  topBar: { padding: Spacing.md },

  form: { padding: Spacing.xl, gap: Spacing.md },
  formTitle: { fontSize: 28, fontWeight: "800", color: Colors.text },
  formSubtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: -Spacing.xs },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: Colors.error + "40",
  },
  errorBannerText: { flex: 1, fontSize: 13, color: Colors.error },

  eyeBtn: { position: "absolute", right: Spacing.md, bottom: 14, zIndex: 1 },
  registerBtn: { marginTop: Spacing.xs },

  loginLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.xs },
  loginText: { fontSize: 14, color: Colors.textSecondary },
  loginTextBold: { fontSize: 14, fontWeight: "700", color: Colors.primary },
});
