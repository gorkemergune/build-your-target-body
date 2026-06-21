import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useAuthStore } from "../src/stores/auth";
import { useRemindersStore } from "../src/stores/reminders";
import { LoadingScreen } from "../src/components/ui/LoadingScreen";
import type { ReminderType } from "../src/stores/reminders";

// Navigate to the relevant tab when a reminder notification is tapped
const REMINDER_ROUTES: Partial<Record<ReminderType, string>> = {
  weight: "/(tabs)/weight",
  workout: "/(tabs)/workouts",
  water: "/(tabs)/nutrition",
  protein: "/(tabs)/nutrition",
  goal: "/(tabs)/",
};

export default function RootLayout() {
  const { initialize, isLoading } = useAuthStore();
  const trackOpen = useRemindersStore((s) => s.trackOpen);
  const notifListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    initialize();

    // Track notification opens (user tapped the notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type as ReminderType | undefined;
      if (type) {
        trackOpen(type);
        const route = REMINDER_ROUTES[type];
        if (route) {
          // Small delay to let the app finish mounting
          setTimeout(() => router.push(route as any), 300);
        }
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Build Your Target Body" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
