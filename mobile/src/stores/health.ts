import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailyHealthData, HealthPermissionStatus, HealthSource } from "../services/health/types";

interface HealthStore {
  // Connection state
  isConnected: boolean;
  source: HealthSource | null;
  permissionStatus: HealthPermissionStatus;
  autoSync: boolean;
  lastSyncAt: string | null; // ISO datetime

  // Today's data (from device)
  todayData: DailyHealthData | null;

  // Imported workout IDs (to track which ones have already been imported)
  importedWorkoutKeys: string[]; // "startDate_name" composite keys

  // Actions
  setConnected: (v: boolean, source: HealthSource | null) => void;
  setPermissionStatus: (s: HealthPermissionStatus) => void;
  setAutoSync: (v: boolean) => void;
  setLastSyncAt: (dt: string) => void;
  setTodayData: (data: DailyHealthData) => void;
  markWorkoutImported: (key: string) => void;
  isWorkoutImported: (key: string) => boolean;
  disconnect: () => void;
}

export const useHealthStore = create<HealthStore>()(
  persist(
    (set, get) => ({
      isConnected: false,
      source: null,
      permissionStatus: "notDetermined",
      autoSync: false,
      lastSyncAt: null,
      todayData: null,
      importedWorkoutKeys: [],

      setConnected: (v, source) => set({ isConnected: v, source }),
      setPermissionStatus: (s) => set({ permissionStatus: s }),
      setAutoSync: (v) => set({ autoSync: v }),
      setLastSyncAt: (dt) => set({ lastSyncAt: dt }),
      setTodayData: (data) => set({ todayData: data }),

      markWorkoutImported: (key) =>
        set((state) => ({
          importedWorkoutKeys: state.importedWorkoutKeys.includes(key)
            ? state.importedWorkoutKeys
            : [...state.importedWorkoutKeys, key],
        })),

      isWorkoutImported: (key) => get().importedWorkoutKeys.includes(key),

      disconnect: () =>
        set({
          isConnected: false,
          source: null,
          permissionStatus: "notDetermined",
          lastSyncAt: null,
          todayData: null,
          autoSync: false,
          importedWorkoutKeys: [],
        }),
    }),
    {
      name: "health-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
