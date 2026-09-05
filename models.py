"""Pydantic request/response models shared across the API."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class FunctionInfo(BaseModel):
    """A single function or class method extracted from source code."""

    id: str
    name: str
    kind: str = Field(description="'function', 'method', or 'class'")
    start_line: int
    end_line: int
    code: str
    params: List[str] = Field(default_factory=list)
    has_docstring: bool = False
    file_path: Optional[str] = None


class FileNode(BaseModel):
    """A single file within an uploaded project/zip."""

    path: str
    language: Optional[str] = None
    size_bytes: int = 0
    skipped: bool = False
    skip_reason: Optional[str] = None
    functions: List[FunctionInfo] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    mode: str = Field(description="'snippet' | 'file' | 'repo'")
    language: Optional[str] = None
    files: List[FileNode] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    llm_mode: str = Field(description="'live' or 'mock' — whether a real LLM key is configured")


class DocstringRequest(BaseModel):
    language: str
    functions: List[FunctionInfo]
    full_code: Optional[str] = Field(
        default=None, description="Original full source, used to splice docstrings back in"
    )


class DocstringResult(BaseModel):
    id: str
    name: str
    docstring: str
    style: str
    error: Optional[str] = None


class DocstringResponse(BaseModel):
    results: List[DocstringResult]
    updated_code: Optional[str] = None
    llm_mode: str


class ExplainRequest(BaseModel):
    language: str
    code: str
    function_name: Optional[str] = None


class ExplainResponse(BaseModel):
    purpose: str
    inputs: str
    outputs: str
    logic_flow: str
    llm_mode: str
    error: Optional[str] = None


class ReadmeRequest(BaseModel):
    project_name: str = "My Project"
    files: List[FileNode]


class ReadmeResponse(BaseModel):
    readme_markdown: str
    llm_mode: str
    error: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
