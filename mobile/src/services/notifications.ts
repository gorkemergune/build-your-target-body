import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ReminderConfig, ReminderType } from "../stores/reminders";

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as "granted" | "denied" | "undetermined";
}

// Weekday constants: Expo uses 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
const WEEKDAY_DAYS = [2, 3, 4, 5, 6]; // Mon–Fri
const WEEKEND_DAYS = [1, 7]; // Sun, Sat

const REMINDER_DEFAULTS: Record<ReminderType, { title: string; defaultBody: string }> = {
  weight: { title: "📊 Weight Log", defaultBody: "Time to log your weight and track your progress!" },
  workout: { title: "💪 Workout Time", defaultBody: "Your workout is waiting — let's get it done!" },
  water: { title: "💧 Hydration Check", defaultBody: "Stay hydrated — drink some water right now!" },
  protein: { title: "🥩 Protein Reminder", defaultBody: "Don't forget to hit your protein target today!" },
  goal: { title: "🎯 Goal Check-in", defaultBody: "How is your transformation going? Stay consistent!" },
};

export async function scheduleReminder(reminder: ReminderConfig): Promise<string[]> {
  const { title, defaultBody } = REMINDER_DEFAULTS[reminder.type];
  const body = reminder.aiMessage || defaultBody;
  const { hour, minute, frequency, type } = reminder;

  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: { type },
    sound: true,
  };

  const ids: string[] = [];

  if (frequency === "daily") {
    const id = await Notifications.scheduleNotificationAsync({
      identifier: `${type}_daily`,
      content,
      trigger: { hour, minute, repeats: true } as Notifications.CalendarTriggerInput,
    });
    ids.push(id);
  } else {
    const days = frequency === "weekdays" ? WEEKDAY_DAYS : WEEKEND_DAYS;
    for (const weekday of days) {
      const id = await Notifications.scheduleNotificationAsync({
        identifier: `${type}_wd_${weekday}`,
        content,
        trigger: { weekday, hour, minute, repeats: true } as Notifications.CalendarTriggerInput,
      });
      ids.push(id);
    }
  }

  return ids;
}

export async function cancelReminder(notificationIds: string[]): Promise<void> {
  await Promise.all(notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function rescheduleReminder(reminder: ReminderConfig): Promise<string[]> {
  if (reminder.notificationIds.length > 0) {
    await cancelReminder(reminder.notificationIds);
  }
  if (!reminder.enabled) return [];
  return scheduleReminder(reminder);
}

export async function cancelAllReminders(reminders: ReminderConfig[]): Promise<void> {
  const ids = reminders.flatMap((r) => r.notificationIds);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function rescheduleAllReminders(reminders: ReminderConfig[]): Promise<Record<ReminderType, string[]>> {
  const result: Partial<Record<ReminderType, string[]>> = {};
  for (const reminder of reminders) {
    const ids = await rescheduleReminder(reminder);
    result[reminder.type] = ids;
  }
  return result as Record<ReminderType, string[]>;
}

export async function getPendingCount(): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.length;
}
