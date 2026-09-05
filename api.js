const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function handle(response) {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON; keep the statusText
    }
    throw new Error(detail);
  }
  return response.json();
}

export async function analyzeSnippet(code, filename) {
  const form = new FormData();
  form.append("code", code);
  if (filename) form.append("filename", filename);
  const res = await fetch(`${BASE_URL}/api/analyze`, { method: "POST", body: form });
  return handle(res);
}

export async function analyzeFile(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/analyze`, { method: "POST", body: form });
  return handle(res);
}

export async function generateDocstrings({ language, functions, fullCode }) {
  const res = await fetch(`${BASE_URL}/api/docstrings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, functions, full_code: fullCode ?? null }),
  });
  return handle(res);
}

export async function explainFunction({ language, code, functionName }) {
  const res = await fetch(`${BASE_URL}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, code, function_name: functionName ?? null }),
  });
  return handle(res);
}

export async function generateReadme({ projectName, files }) {
  const res = await fetch(`${BASE_URL}/api/readme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_name: projectName, files }),
  });
  return handle(res);
}

export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  return handle(res);
}
