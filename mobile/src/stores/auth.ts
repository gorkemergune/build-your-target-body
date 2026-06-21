import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { getMe } from "../api/auth";
import type { User } from "../types";

interface AuthStore {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  biometricAvailable: boolean;

  initialize: () => Promise<void>;
  login: (access_token: string, refresh_token: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  checkBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  biometricAvailable: false,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (token) {
        set({ token });
        try {
          const user = await getMe();
          set({ user });
        } catch {
          // Token may be expired — interceptor handles refresh; if that also fails,
          // user will be signed out on next API call.
        }
      }
      await get().checkBiometric();
    } catch {
      // Ignore initialization errors; start unauthenticated
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (access_token, refresh_token) => {
    await SecureStore.setItemAsync("access_token", access_token);
    await SecureStore.setItemAsync("refresh_token", refresh_token);
    set({ token: access_token });
    try {
      const user = await getMe();
      set({ user });
    } catch {
      // Non-fatal; user profile will load on next navigation
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    set({ token: null, user: null });
  },

  setUser: (user) => set({ user }),

  checkBiometric: async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      set({ biometricAvailable: compatible && enrolled });
    } catch {
      set({ biometricAvailable: false });
    }
  },

  authenticateWithBiometric: async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to continue",
        fallbackLabel: "Use password",
        cancelLabel: "Cancel",
      });
      return result.success;
    } catch {
      return false;
    }
  },
}));
