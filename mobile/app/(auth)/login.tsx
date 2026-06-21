import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { login } from "../../src/api/auth";
import { useAuthStore } from "../../src/stores/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const { login: storeLogin, biometricAvailable, authenticateWithBiometric } = useAuthStore();

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!email.includes("@")) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const tokens = await login(email.trim().toLowerCase(), password);
      await storeLogin(tokens.access_token, tokens.refresh_token);
      router.replace("/(tabs)");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 400) {
        setErrors({ general: "Invalid email or password. Please try again." });
      } else {
        setErrors({ general: "Unable to connect. Check your network and try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometric() {
    const ok = await authenticateWithBiometric();
    if (ok) {
      router.replace("/(tabs)");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="body" size={36} color={Colors.white} />
            </View>
            <Text style={styles.appName}>Build Your Target Body</Text>
            <Text style={styles.tagline}>Your AI-powered transformation journey</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Welcome back</Text>

            {errors.general && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </View>
            )}

            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              error={errors.password}
              // Right icon
              style={{ paddingRight: 44 }}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((p) => !p)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            <Button fullWidth loading={loading} onPress={handleLogin} size="lg" style={styles.loginBtn}>
              Sign In
            </Button>

            {biometricAvailable && (
              <Button variant="outline" fullWidth onPress={handleBiometric} size="md">
                <Ionicons name="finger-print" size={18} color={Colors.primary} />
                {"  "}Sign in with Biometrics
              </Button>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Don't have an account?</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.registerLink}>
              <Text style={styles.registerText}>Create an account</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
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

  header: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  appName: { fontSize: 22, fontWeight: "800", color: Colors.white, textAlign: "center" },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center" },

  form: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  formTitle: { fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: Spacing.xs },

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

  loginBtn: { marginTop: Spacing.xs },
  eyeBtn: { position: "absolute", right: Spacing.md, top: 80, zIndex: 1 },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 13, color: Colors.textMuted },

  registerLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  registerText: { fontSize: 15, fontWeight: "600", color: Colors.primary },
});
