import { apiClient } from "./client";
import type { TokenResponse, User } from "../types";

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>("/api/v1/auth/login", { email, password });
  return res.data;
}

export async function register(
  email: string,
  password: string,
  full_name: string
): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>("/api/v1/auth/register", {
    email,
    password,
    full_name,
  });
  return res.data;
}

export async function refreshTokens(refresh_token: string): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>("/api/v1/auth/refresh", { refresh_token });
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>("/api/v1/users/me");
  return res.data;
}

export async function updateProfile(data: Partial<Pick<User, "full_name" | "height_cm" | "gender" | "activity_level" | "preferred_language">>): Promise<User> {
  const res = await apiClient.put<User>("/api/v1/users/me", data);
  return res.data;
}
