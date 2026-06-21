import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";

export default function AuthLayout() {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
