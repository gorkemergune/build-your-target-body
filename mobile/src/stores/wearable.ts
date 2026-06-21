import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WearableConnection, WearableScores, WearablePlatform } from "../api/wearable";

interface WearableStore {
  connections: WearableConnection[];
  scores: WearableScores | null;
  scoresComputedAt: string | null;

  setConnections: (c: WearableConnection[]) => void;
  addOrUpdateConnection: (c: WearableConnection) => void;
  removeConnection: (platform: WearablePlatform) => void;
  setScores: (s: WearableScores) => void;
  isConnected: (platform: WearablePlatform) => boolean;
  getConnection: (platform: WearablePlatform) => WearableConnection | undefined;
  connectedCount: () => number;
}

export const useWearableStore = create<WearableStore>()(
  persist(
    (set, get) => ({
      connections: [],
      scores: null,
      scoresComputedAt: null,

      setConnections: (c) => set({ connections: c }),

      addOrUpdateConnection: (c) =>
        set((state) => {
          const existing = state.connections.findIndex((x) => x.platform === c.platform);
          if (existing >= 0) {
            const updated = [...state.connections];
            updated[existing] = c;
            return { connections: updated };
          }
          return { connections: [...state.connections, c] };
        }),

      removeConnection: (platform) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.platform !== platform),
        })),

      setScores: (s) => set({ scores: s, scoresComputedAt: s.computed_at }),

      isConnected: (platform) =>
        get().connections.some((c) => c.platform === platform && c.is_connected),

      getConnection: (platform) =>
        get().connections.find((c) => c.platform === platform),

      connectedCount: () =>
        get().connections.filter((c) => c.is_connected).length,
    }),
    {
      name: "wearable-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
