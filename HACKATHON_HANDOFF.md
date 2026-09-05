# HORIZON — Hackathon Handoff

## What judges can verify

HORIZON turns an unfamiliar snippet, source file, or small ZIP repository into an inspectable structural map and three useful outputs: convention-aware documentation, a plain-English function explanation, and a README grounded in the scanned project structure. The workbench supports Python, JavaScript, Java, and C++ detection; uses Monaco for syntax-aware editing; gives copy/download output controls; and discloses whether a live provider or deterministic fallback produced the result.

## Run locally

Open two terminals from the submission root. The backend has no database, migrations, Docker, or hidden services.

```bash
# Terminal 1 — FastAPI
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Optional: export GROQ_API_KEY="..." for live generations
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — React/Vite
cd webapp
pnpm install
pnpm dev
```

The Vite project proxies `/api` to `http://127.0.0.1:8000` during local development. For a separately deployed API, set `VITE_HORIZON_API_URL=https://your-api.example.com` before building the frontend. The backend configuration guide documents Groq-first, Anthropic, and OpenAI environment-variable options. Credentials must remain local and uncommitted.

## Judge-ready demo sequence

| Step | Action | What it proves |
| --- | --- | --- |
| 1 | Paste a short undocumented Python function and select **Analyze code**. | Auto-detection, robust parser-driven structural analysis, language disclosure, function discovery. |
| 2 | Keep the discovered function selected and choose **Generate Docs**. | Google-style documentation generation and in-source rendering. |
| 3 | Select **Explain** next to that function. | Purpose, inputs, outputs, and logic-flow explanation in a reviewable structure. |
| 4 | Select **README**, then **Generate README**. | README generation grounded in scanned paths and functions rather than a generic template. |
| 5 | Upload a small ZIP with Python and JavaScript files. | Project analysis, ignored dependency folders, multi-file structural map, and graceful skipped-file behavior. |
| 6 | Use the copy or download controls. | Output can move into a real development workflow. |

> If no provider key is active, the interface explicitly enters **Fallback mode**. The demo remains complete using deterministic, source-aware output instead of misleading failure states. For the strongest semantic output during judging, configure a valid `GROQ_API_KEY`.

## Quality and security notes

The backend test suite has **23 passing tests** after the upgrade. Upload handling accepts a single source file up to 300 KB or a ZIP up to 5 MB/200 files, skips binary and dependency content, and now also caps archive expansion and suspicious compression ratios before entries are read. The frontend has passed a TypeScript check and production build. It uses no database or authentication because neither is required for this stateless MVP.
