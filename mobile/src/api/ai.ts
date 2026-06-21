import { apiClient } from "./client";
import type { AiMessage } from "../types";
import type { ReminderType } from "../stores/reminders";

export async function sendMessage(message: string): Promise<AiMessage> {
  const res = await apiClient.post<AiMessage>("/api/v1/ai/chat", { message });
  return res.data;
}

export async function getConversations(limit = 50): Promise<AiMessage[]> {
  const res = await apiClient.get<AiMessage[]>("/api/v1/ai/conversations", {
    params: { limit },
  });
  return res.data;
}

export async function clearConversations(): Promise<void> {
  await apiClient.delete("/api/v1/ai/conversations");
}

export interface SmartReminderPayload {
  reminder_types: ReminderType[];
  language?: string;
  calories_today?: number | null;
  protein_today_g?: number | null;
  protein_target_g?: number | null;
  workouts_this_week?: number | null;
  last_weight_kg?: number | null;
  goal_type?: string | null;
  goal_progress_pct?: number | null;
}

export async function getSmartReminders(
  payload: SmartReminderPayload
): Promise<Record<ReminderType, string>> {
  const res = await apiClient.post<Record<ReminderType, string>>(
    "/api/v1/ai/smart-reminders",
    payload
  );
  return res.data;
}
