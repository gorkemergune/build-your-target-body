/**
 * Fire-and-forget analytics client.
 * All methods are silent — they never throw or block the UI.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface QueuedEvent {
  event_type: string;
  event_name?: string;
  session_id?: string;
  properties?: Record<string, unknown>;
}

let _queue: QueuedEvent[] = [];
let _sessionId: string | null = null;
let _flushTimer: ReturnType<typeof setInterval> | null = null;

function _getSessionId(): string {
  if (_sessionId) return _sessionId;
  if (typeof window === "undefined") return "";
  try {
    _sessionId = sessionStorage.getItem("bytb_sid") ?? _newId();
    sessionStorage.setItem("bytb_sid", _sessionId);
  } catch {
    _sessionId = _newId();
  }
  return _sessionId;
}

function _newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function _flush() {
  if (_queue.length === 0) return;
  const events = _queue.splice(0, 25); // drain up to 25
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (!token) return; // not logged in, skip
  try {
    await fetch(`${API_BASE}/api/v1/analytics/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  } catch {
    // silently drop
  }
}

function _init() {
  if (typeof window === "undefined" || _flushTimer) return;
  _flushTimer = setInterval(_flush, 30_000);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") _flush();
  });
}

export function enqueueEvent(
  event_type: string,
  event_name?: string,
  properties?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  _init();
  _queue.push({ event_type, event_name, session_id: _getSessionId(), properties });
  if (_queue.length >= 10) _flush();
}

export function trackPage(pathname: string) {
  enqueueEvent("page_view", pathname);
}

export function trackFeature(feature: string, properties?: Record<string, unknown>) {
  enqueueEvent("feature_used", feature, properties);
}

export async function logError(payload: {
  error_type: "frontend_error" | "api_failure" | "render_error";
  message: string;
  stack_trace?: string;
  endpoint?: string;
  status_code?: number;
}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  try {
    await fetch(`${API_BASE}/api/v1/analytics/error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // silently drop
  }
}
