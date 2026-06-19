"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface User {
  id: number;
  email: string;
  full_name: string;
  preferred_language: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post("/api/v1/auth/login", { email, password });
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        const me = await api.get("/api/v1/users/me");
        set({ user: me.data, isAuthenticated: true });
      },

      register: async (email, password, fullName) => {
        const { data } = await api.post("/api/v1/auth/register", {
          email,
          password,
          full_name: fullName,
        });
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        const me = await api.get("/api/v1/users/me");
        set({ user: me.data, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get("/api/v1/users/me");
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    { name: "auth-store", partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);
