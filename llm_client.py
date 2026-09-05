"""Small, failure-tolerant LLM adapter for Horizon.

Groq is preferred when configured to preserve the project's intended
low-latency hackathon stack. Anthropic and OpenAI remain supported fallback
providers. Every provider failure returns a structured mock-mode result so a
temporary key, rate-limit, or network issue cannot crash the workspace.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


@dataclass
class LLMResult:
    text: str
    mode: str  # "live" or "mock"
    error: Optional[str] = None


def is_live() -> bool:
    return bool(GROQ_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY)


def _call_anthropic(system: str, prompt: str, max_tokens: int) -> str:
    import anthropic  # imported lazily so the package is optional in mock mode

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(block.text for block in response.content if getattr(block, "type", "") == "text")


def _call_openai(system: str, prompt: str, max_tokens: int) -> str:
    from openai import OpenAI  # imported lazily, same reasoning as above

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )
    return response.choices[0].message.content or ""


def _call_groq(system: str, prompt: str, max_tokens: int) -> str:
    """Use Groq's OpenAI-compatible API without adding another dependency."""
    from openai import OpenAI

    client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=max_tokens,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )
    return response.choices[0].message.content or ""


def complete(system: str, prompt: str, max_tokens: int = 1500) -> LLMResult:
    """Call the configured provider (Groq, Claude, then OpenAI).
    On any failure - missing key, bad key, rate limit, network error - this
    returns ``mode="mock"`` rather than raising, so a single flaky/unset
    provider never crashes the request; the caller decides what mock output
    to show and the underlying error is preserved for display/debugging.
    """
    if not is_live():
        return LLMResult(text="", mode="mock")

    try:
        if GROQ_API_KEY:
            text = _call_groq(system, prompt, max_tokens)
        elif ANTHROPIC_API_KEY:
            text = _call_anthropic(system, prompt, max_tokens)
        else:
            text = _call_openai(system, prompt, max_tokens)
        return LLMResult(text=text, mode="live")
    except Exception as exc:  # noqa: BLE001 - any provider failure degrades to mock, not a crash
        return LLMResult(text="", mode="mock", error=f"{type(exc).__name__}: {exc}")
