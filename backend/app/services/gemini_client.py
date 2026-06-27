"""
Central Gemini API wrapper.

All Gemini calls route through `call_gemini()`.
- Never raises; always returns text or `fallback`.
- Logs every call: prompt_type, model, latency_ms, token usage, errors.
- asyncio.wait_for wraps the blocking SDK call so the event loop is never blocked.
"""
import asyncio
import logging
import time

from app.core.config import settings

_log = logging.getLogger("app.gemini")

GEMINI_MODEL = "gemini-2.5-flash"

_RATE_LIMIT_MARKERS = ("429", "resource_exhausted", "quota", "rate limit")


class GeminiQuotaError(Exception):
    """Raised when Gemini returns a rate-limit / quota-exceeded error."""


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in _RATE_LIMIT_MARKERS)


async def call_gemini(
    prompt: "str | list",
    *,
    prompt_type: str,
    timeout_s: float = 25.0,
    fallback: str = "",
    raise_on_rate_limit: bool = False,
) -> str:
    """
    Call Gemini and return generated text.

    Args:
        prompt: string (text-only) or list (multimodal parts).
        prompt_type: label for logs, e.g. "ai_chat", "weekly_report".
        timeout_s: wall-clock seconds before giving up.
        fallback: returned when key missing, timeout, or any error.
    """
    if not settings.GEMINI_API_KEY:
        _log.warning('{"event":"gemini_skip","reason":"no_key","prompt_type":"%s"}', prompt_type)
        return fallback

    import google.generativeai as genai  # lazy — avoids import cost at startup

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    t0 = time.perf_counter()
    try:
        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: model.generate_content(prompt)),
            timeout=timeout_s,
        )
        latency_ms = round((time.perf_counter() - t0) * 1000)

        token_in = token_out = None
        try:
            token_in = response.usage_metadata.prompt_token_count
            token_out = response.usage_metadata.candidates_token_count
        except Exception:
            pass

        _log.info(
            '{"event":"gemini_ok","prompt_type":"%s","model":"%s","latency_ms":%d,"token_in":%s,"token_out":%s}',
            prompt_type,
            GEMINI_MODEL,
            latency_ms,
            token_in,
            token_out,
        )
        return response.text.strip()

    except asyncio.TimeoutError:
        latency_ms = round((time.perf_counter() - t0) * 1000)
        _log.warning(
            '{"event":"gemini_timeout","prompt_type":"%s","timeout_s":%s,"latency_ms":%d}',
            prompt_type,
            timeout_s,
            latency_ms,
        )

    except Exception as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000)
        rate_limited = _is_rate_limit(exc)
        _log.error(
            '{"event":"gemini_error","prompt_type":"%s","error_type":"%s","rate_limited":%s,"detail":"%s","latency_ms":%d}',
            prompt_type,
            type(exc).__name__,
            str(rate_limited).lower(),
            str(exc)[:200].replace('"', "'"),
            latency_ms,
        )
        if rate_limited and raise_on_rate_limit:
            raise GeminiQuotaError(str(exc)) from exc

    return fallback
