import axios from "axios";
import { trackFeature, logError } from "@/lib/analytics";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Map successful API calls to feature_used events
const _FEATURE_MAP: Array<[string, RegExp, string]> = [
  ["POST", /\/api\/v1\/weight/, "weight_log"],
  ["POST", /\/api\/v1\/workouts/, "workout_log"],
  ["POST", /\/api\/v1\/nutrition\/analyze-photo/, "food_scan"],
  ["POST", /\/api\/v1\/nutrition/, "nutrition_log"],
  ["POST", /\/api\/v1\/photos/, "photo_upload"],
  ["POST", /\/api\/v1\/ai\/chat/, "ai_chat"],
  ["POST", /\/api\/v1\/reports/, "report_generate"],
  ["POST", /\/api\/v1\/coach\/generate/, "coach_generate"],
  ["GET", /\/api\/v1\/export\/json/, "export_json"],
  ["GET", /\/api\/v1\/export\/csv/, "export_csv"],
  ["GET", /\/api\/v1\/export\/full-backup/, "export_backup"],
  ["POST", /\/api\/v1\/import\/json/, "import_data"],
];

api.interceptors.response.use(
  (res) => {
    // Track feature usage on successful writes
    const method = (res.config.method ?? "").toUpperCase();
    const url = res.config.url ?? "";
    for (const [m, pattern, feature] of _FEATURE_MAP) {
      if (method === m && pattern.test(url)) {
        trackFeature(feature);
        break;
      }
    }
    return res;
  },
  async (error) => {
    const original = error.config;

    // Token refresh on 401
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
            { refresh_token: refreshToken }
          );
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/tr/auth/login";
        }
      }
    }

    // Log 5xx errors (skip analytics endpoints to prevent loops)
    const url = original?.url ?? "";
    const status = error.response?.status;
    if (status >= 500 && !url.includes("/analytics/")) {
      logError({
        error_type: "api_failure",
        message: error.response?.data?.detail ?? error.message ?? "Server error",
        endpoint: url,
        status_code: status,
      });
    }

    return Promise.reject(error);
  }
);
