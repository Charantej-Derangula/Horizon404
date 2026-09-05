"""Helpers for handling uploaded files/zips safely: size limits, binary
detection, and skipping noise directories (node_modules, .git, venvs, ...)."""
from __future__ import annotations

import zipfile
from dataclasses import dataclass
from io import BytesIO
from typing import List, Optional

MAX_FILE_BYTES = 300_000  # ~300 KB per source file
MAX_ZIP_BYTES = 5_000_000  # 5 MB total upload
MAX_FILES_IN_ZIP = 200
MAX_UNCOMPRESSED_ZIP_BYTES = 8_000_000  # guard against compressed payload expansion
MAX_COMPRESSION_RATIO = 100  # reject obvious zip-bomb entries before reading them

_IGNORED_DIR_PARTS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "target", ".idea", ".vscode",
}


@dataclass
class ExtractedFile:
    path: str
    content: Optional[str]
    size_bytes: int
    skipped: bool = False
    skip_reason: Optional[str] = None


def is_probably_binary(raw: bytes) -> bool:
    if b"\x00" in raw[:8000]:
        return True
    text_chars = bytes(range(32, 127)) + b"\n\r\t\f\b"
    nontext = raw[:8000].translate(None, text_chars)
    return len(nontext) / max(1, len(raw[:8000])) > 0.30


def decode_safely(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def should_ignore_path(path: str) -> bool:
    parts = path.replace("\\", "/").split("/")
    return any(p in _IGNORED_DIR_PARTS for p in parts)


def extract_single_file(filename: str, raw: bytes) -> ExtractedFile:
    size = len(raw)
    if size > MAX_FILE_BYTES:
        return ExtractedFile(
            path=filename, content=None, size_bytes=size, skipped=True,
            skip_reason=f"File is {size:,} bytes, over the {MAX_FILE_BYTES:,}-byte limit.",
        )
    if is_probably_binary(raw):
        return ExtractedFile(
            path=filename, content=None, size_bytes=size, skipped=True,
            skip_reason="File appears to be binary, not source code.",
        )
    return ExtractedFile(path=filename, content=decode_safely(raw), size_bytes=size)


def extract_zip(raw: bytes) -> List[ExtractedFile]:
    if len(raw) > MAX_ZIP_BYTES:
        raise ValueError(f"Zip is {len(raw):,} bytes, over the {MAX_ZIP_BYTES:,}-byte limit.")

    results: List[ExtractedFile] = []
    try:
        with zipfile.ZipFile(BytesIO(raw)) as zf:
            infos = [i for i in zf.infolist() if not i.is_dir()]
            if len(infos) > MAX_FILES_IN_ZIP:
                raise ValueError(
                    f"Zip contains {len(infos)} files, over the {MAX_FILES_IN_ZIP}-file limit."
                )
            uncompressed_bytes = sum(info.file_size for info in infos)
            if uncompressed_bytes > MAX_UNCOMPRESSED_ZIP_BYTES:
                raise ValueError(
                    "Zip expands beyond the 8,000,000-byte safety limit. Upload a smaller project."
                )
            for info in infos:
                if should_ignore_path(info.filename):
                    continue
                if info.file_size > MAX_FILE_BYTES:
                    results.append(
                        ExtractedFile(
                            path=info.filename,
                            content=None,
                            size_bytes=info.file_size,
                            skipped=True,
                            skip_reason=f"File is {info.file_size:,} bytes, over the {MAX_FILE_BYTES:,}-byte limit.",
                        )
                    )
                    continue
                if info.compress_size and info.file_size / info.compress_size > MAX_COMPRESSION_RATIO:
                    results.append(
                        ExtractedFile(
                            path=info.filename,
                            content=None,
                            size_bytes=info.file_size,
                            skipped=True,
                            skip_reason="File compression ratio exceeds the archive safety limit.",
                        )
                    )
                    continue
                file_bytes = zf.read(info)
                results.append(extract_single_file(info.filename, file_bytes))
    except zipfile.BadZipFile as exc:
        raise ValueError("Uploaded file is not a valid zip archive.") from exc

    return results
