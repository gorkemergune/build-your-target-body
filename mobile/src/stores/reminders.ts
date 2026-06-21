import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReminderType = "weight" | "workout" | "water" | "protein" | "goal";
export type ReminderFrequency = "daily" | "weekdays" | "weekends";

export interface ReminderConfig {
  type: ReminderType;
  enabled: boolean;
  hour: number;
  minute: number;
  frequency: ReminderFrequency;
  aiMessage: string | null;
  notificationIds: string[];
}

export interface NotifStats {
  opens: number;
  lastOpened: string | null;
}

const DEFAULT_REMINDERS: ReminderConfig[] = [
  { type: "weight", enabled: false, hour: 8, minute: 0, frequency: "daily", aiMessage: null, notificationIds: [] },
  { type: "workout", enabled: false, hour: 18, minute: 0, frequency: "weekdays", aiMessage: null, notificationIds: [] },
  { type: "water", enabled: false, hour: 14, minute: 0, frequency: "daily", aiMessage: null, notificationIds: [] },
  { type: "protein", enabled: false, hour: 20, minute: 0, frequency: "daily", aiMessage: null, notificationIds: [] },
  { type: "goal", enabled: false, hour: 9, minute: 0, frequency: "daily", aiMessage: null, notificationIds: [] },
];

interface RemindersStore {
  reminders: ReminderConfig[];
  analytics: Record<ReminderType, NotifStats>;
  permissionGranted: boolean;

  setPermissionGranted: (v: boolean) => void;
  updateReminder: (type: ReminderType, patch: Partial<ReminderConfig>) => void;
  setReminders: (reminders: ReminderConfig[]) => void;
  trackOpen: (type: ReminderType) => void;
  getReminderByType: (type: ReminderType) => ReminderConfig;
}

const defaultAnalytics = (): Record<ReminderType, NotifStats> => ({
  weight: { opens: 0, lastOpened: null },
  workout: { opens: 0, lastOpened: null },
  water: { opens: 0, lastOpened: null },
  protein: { opens: 0, lastOpened: null },
  goal: { opens: 0, lastOpened: null },
});

export const useRemindersStore = create<RemindersStore>()(
  persist(
    (set, get) => ({
      reminders: DEFAULT_REMINDERS,
      analytics: defaultAnalytics(),
      permissionGranted: false,

      setPermissionGranted: (v) => set({ permissionGranted: v }),

      updateReminder: (type, patch) =>
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.type === type ? { ...r, ...patch } : r
          ),
        })),

      setReminders: (reminders) => set({ reminders }),

      trackOpen: (type) =>
        set((state) => ({
          analytics: {
            ...state.analytics,
            [type]: {
              opens: (state.analytics[type]?.opens ?? 0) + 1,
              lastOpened: new Date().toISOString(),
            },
          },
        })),

      getReminderByType: (type) =>
        get().reminders.find((r) => r.type === type) ??
        DEFAULT_REMINDERS.find((r) => r.type === type)!,
    }),
    {
      name: "reminders-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
