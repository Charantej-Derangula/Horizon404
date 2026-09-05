"""FastAPI backend for the AI-Powered Code Documentation Generator.

Endpoints (see SRS section 3, "Core Features"):
    POST /api/analyze     - paste / single file / zip upload -> detected
                             language(s) + extracted functions/classes
    POST /api/docstrings  - generate docstrings for a set of functions
    POST /api/explain     - "Explain this function" mode
    POST /api/readme      - generate a README.md from project structure
    GET  /api/health      - liveness check
"""
from __future__ import annotations

import os
import uuid
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import docstring_service, explain_service, language_detect, llm_client, readme_service, utils
from .language_detect import SUPPORTED_LANGUAGES
from .models import (
    AnalyzeResponse,
    DocstringRequest,
    DocstringResponse,
    ExplainRequest,
    ExplainResponse,
    FileNode,
    FunctionInfo,
    ReadmeRequest,
    ReadmeResponse,
)
from .parsers import extract_functions

app = FastAPI(
    title="AI-Powered Code Documentation Generator API",
    version="0.1.0",
    description="Backend for docstring generation, function explanation, and README generation.",
)

_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _llm_mode() -> str:
    return "live" if llm_client.is_live() else "mock"


def _new_id() -> str:
    return uuid.uuid4().hex[:8]


def _build_file_node(path: str, content: str, size_bytes: int) -> FileNode:
    language = language_detect.detect_language(content, path)
    if language is None or language not in SUPPORTED_LANGUAGES:
        return FileNode(
            path=path,
            size_bytes=size_bytes,
            skipped=True,
            skip_reason="Unsupported or undetected language (supported: "
            + ", ".join(sorted(SUPPORTED_LANGUAGES))
            + ").",
        )
    raw_functions = extract_functions(language, content)
    functions = [FunctionInfo(id=_new_id(), file_path=path, **rf) for rf in raw_functions]
    warnings = []
    return FileNode(path=path, language=language, size_bytes=size_bytes, functions=functions)


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_mode": _llm_mode()}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    code: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    warnings: List[str] = []

    if file is not None:
        raw = await file.read()
        name = file.filename or "uploaded"

        if name.lower().endswith(".zip"):
            try:
                extracted = utils.extract_zip(raw)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

            if not extracted:
                raise HTTPException(status_code=400, detail="Zip archive contained no readable files.")

            files: List[FileNode] = []
            for ef in extracted:
                if ef.skipped:
                    files.append(FileNode(path=ef.path, size_bytes=ef.size_bytes, skipped=True, skip_reason=ef.skip_reason))
                else:
                    files.append(_build_file_node(ef.path, ef.content, ef.size_bytes))

            analyzed_count = sum(1 for f in files if not f.skipped)
            if analyzed_count == 0:
                warnings.append("No supported source files were found in this archive.")

            return AnalyzeResponse(mode="repo", files=files, warnings=warnings, llm_mode=_llm_mode())

        ef = utils.extract_single_file(name, raw)
        if ef.skipped:
            raise HTTPException(status_code=400, detail=ef.skip_reason)
        node = _build_file_node(ef.path, ef.content, ef.size_bytes)
        if node.skipped:
            raise HTTPException(status_code=400, detail=node.skip_reason)
        return AnalyzeResponse(mode="file", language=node.language, files=[node], warnings=warnings, llm_mode=_llm_mode())

    if code is not None:
        if not code.strip():
            raise HTTPException(status_code=400, detail="Pasted code is empty.")
        raw = code.encode("utf-8")
        if len(raw) > utils.MAX_FILE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Pasted code is {len(raw):,} bytes, over the {utils.MAX_FILE_BYTES:,}-byte limit.",
            )
        name = filename or "snippet.txt"
        node = _build_file_node(name, code, len(raw))
        if node.skipped:
            raise HTTPException(status_code=400, detail=node.skip_reason)
        return AnalyzeResponse(mode="snippet", language=node.language, files=[node], warnings=warnings, llm_mode=_llm_mode())

    raise HTTPException(status_code=400, detail="Provide either 'code' (pasted text) or a 'file' upload.")


@app.post("/api/docstrings", response_model=DocstringResponse)
def generate_docstrings(req: DocstringRequest):
    if req.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language '{req.language}'.")
    if not req.functions:
        raise HTTPException(status_code=400, detail="No functions provided to document.")

    results, mode = docstring_service.generate(req.language, req.functions)

    updated_code = None
    if req.full_code:
        updated_code = docstring_service.splice_into_code(req.full_code, req.language, req.functions, results)

    return DocstringResponse(results=results, updated_code=updated_code, llm_mode=mode)


@app.post("/api/explain", response_model=ExplainResponse)
def explain_function(req: ExplainRequest):
    if req.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language '{req.language}'.")
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="No code provided to explain.")
    return explain_service.explain(req.language, req.code, req.function_name)


@app.post("/api/readme", response_model=ReadmeResponse)
def generate_readme(req: ReadmeRequest):
    if not req.files:
        raise HTTPException(status_code=400, detail="No analyzed files provided.")
    return readme_service.generate(req.project_name, req.files)
