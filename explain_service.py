"""'Explain this function' mode: a plain-English walkthrough of purpose,
inputs, outputs, and logic flow, aimed at a newcomer reading the code for
the first time (per the SRS's 'senior developer walking a newcomer through
the code' framing)."""
from __future__ import annotations

import json
import re

from . import llm_client
from .models import ExplainResponse

_SYSTEM = (
    "You are a senior software engineer explaining unfamiliar code to a new team "
    "member. Be clear, accurate, and jargon-free. You always respond with strictly "
    "valid JSON and nothing else."
)


def _build_prompt(language: str, code: str, function_name: str | None) -> str:
    target = f" (focus on the function/method named `{function_name}`)" if function_name else ""
    return (
        f"Explain the following {language} code{target} for a newcomer.\n\n"
        f"```{language}\n{code}\n```\n\n"
        "Respond with ONLY a JSON object, no prose outside it, shaped like:\n"
        '{"purpose": "...", "inputs": "...", "outputs": "...", "logic_flow": "..."}\n'
        "- purpose: one or two sentences on what it's for.\n"
        "- inputs: what parameters/state it reads, and any constraints.\n"
        "- outputs: what it returns or what side effects it has.\n"
        "- logic_flow: a short, plain-English walkthrough of the steps/control flow."
    )


def _extract_json(text: str) -> dict:
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else text
    if not fence_match:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end != -1:
            candidate = candidate[start : end + 1]
    return json.loads(candidate)


def _mock_explanation(code: str, function_name: str | None) -> dict:
    """Return a transparent, source-grounded offline explanation."""
    name = function_name or "this code block"
    signature = code.split("{")[0]
    params_match = re.search(r"\(([^)]*)\)", signature)
    params = params_match.group(1).strip() if params_match and params_match.group(1).strip() else "the values available in its scope"
    steps = []
    if re.search(r"\b(for|while)\b", code):
        steps.append("iterates through the values indicated by its loop")
    if re.search(r"\b(if|else|switch|case)\b", code):
        steps.append("branches when its conditions are met")
    if re.search(r"\breturn\b", code):
        steps.append("returns the resulting value")
    if not steps:
        steps.append("runs the statements shown in the function body")
    return {
        "purpose": f"Offline analysis: {name} performs the operation represented by its implementation. Connect an LLM provider for a deeper semantic explanation.",
        "inputs": f"The implementation receives or reads {params}.",
        "outputs": "The exact output should be verified from the return statements and side effects in the displayed source.",
        "logic_flow": "It " + ", then ".join(steps) + ".",
    }


def explain(language: str, code: str, function_name: str | None) -> ExplainResponse:
    if not code.strip():
        return ExplainResponse(
            purpose="", inputs="", outputs="", logic_flow="",
            llm_mode="mock", error="No code provided.",
        )

    if not llm_client.is_live():
        mock = _mock_explanation(code, function_name)
        return ExplainResponse(**mock, llm_mode="mock")

    prompt = _build_prompt(language, code, function_name)
    result = llm_client.complete(_SYSTEM, prompt, max_tokens=800)

    if result.mode == "mock":
        mock = _mock_explanation(code, function_name)
        return ExplainResponse(**mock, llm_mode="mock", error=result.error)

    try:
        parsed = _extract_json(result.text)
        return ExplainResponse(
            purpose=parsed.get("purpose", ""),
            inputs=parsed.get("inputs", ""),
            outputs=parsed.get("outputs", ""),
            logic_flow=parsed.get("logic_flow", ""),
            llm_mode="live",
        )
    except (json.JSONDecodeError, TypeError) as exc:
        return ExplainResponse(
            purpose=result.text.strip()[:2000],
            inputs="", outputs="", logic_flow="",
            llm_mode="live",
            error=f"Model response wasn't valid JSON ({exc}); showing raw output in 'purpose'.",
        )
