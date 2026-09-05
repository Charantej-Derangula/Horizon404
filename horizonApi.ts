import type { AnalyzeResponse, DocstringResponse, ExplainResponse, FileNode, FunctionInfo, ReadmeResponse } from "./horizonTypes";

// The endpoint functions include `/api/*`. An empty same-origin base lets Vite
// proxy that path locally; deployments can provide an explicit API origin.
const API_BASE = (import.meta.env.VITE_HORIZON_API_URL || "").replace(/\/$/, "");

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : response.statusText || "The request could not be completed.");
  }
  return response.json() as Promise<T>;
}

export async function getHealth(): Promise<{ status: string; llm_mode: "live" | "mock" }> {
  return parse(await fetch(`${API_BASE}/api/health`));
}

export async function analyzeSnippet(code: string, filename: string): Promise<AnalyzeResponse> {
  const body = new FormData();
  body.append("code", code);
  body.append("filename", filename);
  return parse(await fetch(`${API_BASE}/api/analyze`, { method: "POST", body }));
}

export async function analyzeFile(file: File): Promise<AnalyzeResponse> {
  const body = new FormData();
  body.append("file", file);
  return parse(await fetch(`${API_BASE}/api/analyze`, { method: "POST", body }));
}

export async function generateDocs(language: string, functions: FunctionInfo[], fullCode?: string): Promise<DocstringResponse> {
  return parse(await fetch(`${API_BASE}/api/docstrings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, functions, full_code: fullCode || null }),
  }));
}

export async function explainCode(language: string, code: string, functionName: string): Promise<ExplainResponse> {
  return parse(await fetch(`${API_BASE}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, code, function_name: functionName }),
  }));
}

export async function generateReadme(projectName: string, files: FileNode[]): Promise<ReadmeResponse> {
  return parse(await fetch(`${API_BASE}/api/readme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_name: projectName, files }),
  }));
}
