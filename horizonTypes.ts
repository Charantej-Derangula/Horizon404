export type Language = "python" | "javascript" | "java" | "cpp";

export type FunctionInfo = {
  id: string;
  name: string;
  kind: "function" | "method" | "class";
  start_line: number;
  end_line: number;
  code: string;
  params: string[];
  has_docstring: boolean;
  file_path?: string | null;
};

export type FileNode = {
  path: string;
  language?: Language | null;
  size_bytes: number;
  skipped: boolean;
  skip_reason?: string | null;
  functions: FunctionInfo[];
};

export type AnalyzeResponse = {
  mode: "snippet" | "file" | "repo";
  language?: Language | null;
  files: FileNode[];
  warnings: string[];
  llm_mode: "live" | "mock";
};

export type DocstringResult = { id: string; name: string; docstring: string; style: string; error?: string | null };
export type DocstringResponse = { results: DocstringResult[]; updated_code?: string | null; llm_mode: "live" | "mock" };
export type ExplainResponse = { purpose: string; inputs: string; outputs: string; logic_flow: string; llm_mode: "live" | "mock"; error?: string | null };
export type ReadmeResponse = { readme_markdown: string; llm_mode: "live" | "mock"; error?: string | null };
