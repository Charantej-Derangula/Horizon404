"""Generate a basic README.md from an analyzed project's file/function
structure, per the SRS (Overview, Setup, Usage sections)."""
from __future__ import annotations

from typing import List

from . import llm_client
from .models import FileNode, ReadmeResponse

_SYSTEM = (
    "You are a technical writer generating a clear, concise README.md for a "
    "software project based on a verified summary of its files and functions. Do not "
    "invent package managers, commands, dependencies, or features not supported by the summary."
)


def _summarize_structure(files: List[FileNode]) -> str:
    lines = []
    for f in files:
        if f.skipped:
            lines.append(f"- {f.path} (skipped: {f.skip_reason})")
            continue
        lines.append(f"- {f.path} ({f.language or 'unknown'})")
        for fn in f.functions:
            params = ", ".join(fn.params)
            lines.append(f"    - {fn.kind} `{fn.name}({params})`")
    return "\n".join(lines) if lines else "(no files analyzed)"


def _build_prompt(project_name: str, files: List[FileNode]) -> str:
    structure = _summarize_structure(files)
    return (
        f"Project name: {project_name}\n\n"
        f"File/function structure:\n{structure}\n\n"
        "Write a README.md (Markdown) with these sections: Overview (clearly label inferences), "
        "Project Structure, Setup (only safe, language-appropriate guidance), and Usage (include "
        "an example only where the function structure makes one defensible). Keep it concise. "
        "Respond with ONLY the Markdown content, no commentary before or after."
    )


def _mock_readme(project_name: str, files: List[FileNode]) -> str:
    structure = _summarize_structure(files)
    return (
        f"# {project_name}\n\n"
        "## Overview\n\n"
        "This README was created from the verified file and function structure. Connect Groq, "
        "Anthropic, or OpenAI for a richer semantic project summary.\n\n"
        "## Project structure\n\n"
        f"```\n{structure}\n```\n\n"
        "## Setup\n\n"
        "```bash\n# install dependencies for this project's language(s)\n```\n\n"
        "## Usage\n\n"
        "_Describe how to run/use the project here._\n"
    )


def generate(project_name: str, files: List[FileNode]) -> ReadmeResponse:
    if not llm_client.is_live():
        return ReadmeResponse(readme_markdown=_mock_readme(project_name, files), llm_mode="mock")

    prompt = _build_prompt(project_name, files)
    result = llm_client.complete(_SYSTEM, prompt, max_tokens=1200)

    if result.mode == "mock":
        return ReadmeResponse(
            readme_markdown=_mock_readme(project_name, files), llm_mode="mock", error=result.error
        )

    return ReadmeResponse(readme_markdown=result.text.strip(), llm_mode="live")
