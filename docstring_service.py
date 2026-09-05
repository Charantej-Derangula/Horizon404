"""Generate docstrings/comment blocks for extracted functions, in the style
appropriate to each language (Google-style for Python, JSDoc for
JavaScript, Javadoc for Java, Doxygen for C++), per the SRS."""
from __future__ import annotations

import json
import re
from typing import Dict, List

from . import llm_client
from .models import DocstringResult, FunctionInfo

STYLE_NAMES = {
    "python": "Google-style Python docstring",
    "javascript": "JSDoc comment block",
    "java": "Javadoc comment block",
    "cpp": "Doxygen comment block",
}


def _extract_json(text: str) -> List[Dict]:
    """Pull a JSON array out of an LLM response, tolerating ```json fences
    or minor leading/trailing prose."""
    fence_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else text
    if not fence_match:
        start = candidate.find("[")
        end = candidate.rfind("]")
        if start != -1 and end != -1:
            candidate = candidate[start : end + 1]
    return json.loads(candidate)


def _build_prompt(language: str, functions: List[FunctionInfo]) -> str:
    style = STYLE_NAMES.get(language, "a clear docstring")
    items = "\n\n".join(f"### id: {f.id}\n```{language}\n{f.code}\n```" for f in functions)
    return (
        f"You are documenting a {language} codebase. For each function/class below, "
        f"write a concise, accurate {style} covering purpose, parameters, return value, "
        f"side effects, and exceptions only when they are directly evident in the source. "
        "Do not invent types, dependencies, behavior, or TODOs. Preserve the convention "
        "for the requested language and return a doc block only, not source code.\n\n"
        f"{items}\n\n"
        "Respond with ONLY a JSON array, no prose, no markdown fences, shaped like:\n"
        '[{"id": "<the id given above>", "docstring": "<the docstring/comment text, '
        'without the surrounding function code>"}, ...]'
    )


def _mock_docstring(func: FunctionInfo, language: str) -> str:
    params = func.params or []
    readable_name = func.name.replace("_", " ").strip().capitalize() or "Performs this operation"
    if language == "python":
        lines = [f"{readable_name}."]
        if params:
            lines.append("")
            lines.append("Args:")
            for p in params:
                lines.append(f"    {p}: Value used by this operation.")
        lines.append("")
        lines.append("Returns:")
        lines.append("    The value produced by this operation, if any.")
        return "\n".join(lines)
    if language == "javascript":
        lines = ["/**", f" * {readable_name}."]
        for p in params:
            clean = p.split("=")[0].strip()
            lines.append(f" * @param {{*}} {clean} Value used by this operation.")
        lines.append(" * @returns {*} The value produced by this operation, if any.")
        lines.append(" */")
        return "\n".join(lines)
    if language == "java":
        lines = ["/**", f" * {readable_name}."]
        for p in params:
            clean = p.split(" ")[-1]
            lines.append(f" * @param {clean} Value used by this operation.")
        lines.append(" * @return The value produced by this operation, if any.")
        lines.append(" */")
        return "\n".join(lines)
    if language == "cpp":
        lines = ["/**", f" * @brief {readable_name}."]
        for p in params:
            clean = p.split(" ")[-1].lstrip("*&")
            lines.append(f" * @param {clean} Value used by this operation.")
        lines.append(" * @return The value produced by this operation, if any.")
        lines.append(" */")
        return "\n".join(lines)
    return f"TODO: document {func.name}."


def generate(language: str, functions: List[FunctionInfo]) -> tuple[List[DocstringResult], str]:
    """Returns (results, llm_mode)."""
    if not functions:
        return [], ("live" if llm_client.is_live() else "mock")

    style = STYLE_NAMES.get(language, "docstring")

    if llm_client.is_live():
        system = (
            "You are an expert software documentation generator. You always respond "
            "with strictly valid JSON and nothing else."
        )
        prompt = _build_prompt(language, functions)
        result = llm_client.complete(system, prompt, max_tokens=400 * len(functions) + 300)

        if result.mode == "live":
            try:
                parsed = _extract_json(result.text)
                by_id = {item["id"]: item.get("docstring", "") for item in parsed if "id" in item}
                results = []
                for f in functions:
                    docstring = by_id.get(f.id)
                    if docstring:
                        results.append(DocstringResult(id=f.id, name=f.name, docstring=docstring, style=style))
                    else:
                        results.append(
                            DocstringResult(
                                id=f.id,
                                name=f.name,
                                docstring=_mock_docstring(f, language),
                                style=style,
                                error="Model response did not include this function; used a placeholder.",
                            )
                        )
                return results, "live"
            except (json.JSONDecodeError, KeyError, TypeError) as exc:
                results = [
                    DocstringResult(
                        id=f.id,
                        name=f.name,
                        docstring=_mock_docstring(f, language),
                        style=style,
                        error=f"Could not parse model response ({exc}); used a placeholder.",
                    )
                    for f in functions
                ]
                return results, "mock"
        # live provider errored -> fall through to mock below, surfacing the error
        results = [
            DocstringResult(
                id=f.id,
                name=f.name,
                docstring=_mock_docstring(f, language),
                style=style,
                error=result.error,
            )
            for f in functions
        ]
        return results, "mock"

    results = [
        DocstringResult(id=f.id, name=f.name, docstring=_mock_docstring(f, language), style=style)
        for f in functions
    ]
    return results, "mock"


def splice_into_code(full_code: str, language: str, functions: List[FunctionInfo], results: List[DocstringResult]) -> str:
    """Insert each generated docstring/comment back into the original source."""
    updated = full_code
    by_id = {r.id: r.docstring for r in results}

    for f in functions:
        docstring = by_id.get(f.id)
        if not docstring or f.code not in updated:
            continue
        if language == "python":
            lines = f.code.splitlines()
            if not lines:
                continue
            header = lines[0]
            indent = re.match(r"^(\s*)", lines[1] if len(lines) > 1 else header).group(1) or "    "
            doc_lines = docstring.strip().splitlines() or [""]
            if len(doc_lines) == 1:
                doc_block = f'{indent}"""{doc_lines[0]}"""'
            else:
                doc_block = "\n".join([f'{indent}"""{doc_lines[0]}'] + [f"{indent}{l}" for l in doc_lines[1:]] + [f'{indent}"""'])
            new_code = "\n".join([header, doc_block] + lines[1:])
        else:
            indent = re.match(r"^(\s*)", f.code).group(1)
            commented = "\n".join(f"{indent}{l}" if i > 0 else l for i, l in enumerate(docstring.strip().splitlines()))
            new_code = f"{commented}\n{f.code}"
        updated = updated.replace(f.code, new_code, 1)

    return updated
