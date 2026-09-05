import { useState } from "react";
import Editor from "@monaco-editor/react";

const MONACO_LANGUAGE_MAP = {
  python: "python",
  javascript: "javascript",
  java: "java",
  cpp: "cpp",
};

export default function CodeInputPanel({
  detectedLanguage,
  onAnalyzeSnippet,
  onAnalyzeFile,
  loading,
}) {
  const [tab, setTab] = useState("paste");
  const [code, setCode] = useState(
    "def add(a, b):\n    return a + b\n\n\nclass Greeter:\n    def __init__(self, name):\n        self.name = name\n\n    def greet(self):\n        return f\"Hello, {self.name}\"\n"
  );
  const [filename, setFilename] = useState("snippet.py");
  const [singleFile, setSingleFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);

  const monacoLang = MONACO_LANGUAGE_MAP[detectedLanguage] || "python";

  return (
    <div className="panel">
      <div className="tabs">
        <button className={tab === "paste" ? "tab active" : "tab"} onClick={() => setTab("paste")}>
          Paste code
        </button>
        <button className={tab === "file" ? "tab active" : "tab"} onClick={() => setTab("file")}>
          Upload file
        </button>
        <button className={tab === "zip" ? "tab active" : "tab"} onClick={() => setTab("zip")}>
          Upload repo (.zip)
        </button>
      </div>

      {tab === "paste" && (
        <div className="paste-tab">
          <input
            type="text"
            className="filename-input"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="filename (e.g. main.py) — optional, helps language detection"
          />
          <div className="editor-wrapper">
            <Editor
              height="360px"
              language={monacoLang}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
            />
          </div>
          <button
            className="primary-btn"
            disabled={loading || !code.trim()}
            onClick={() => onAnalyzeSnippet(code, filename)}
          >
            {loading ? "Analyzing…" : "Analyze code"}
          </button>
        </div>
      )}

      {tab === "file" && (
        <div className="file-tab">
          <p className="hint">Upload a single source file (.py, .js, .java, .cpp, …).</p>
          <input
            type="file"
            onChange={(e) => setSingleFile(e.target.files?.[0] ?? null)}
          />
          <button
            className="primary-btn"
            disabled={loading || !singleFile}
            onClick={() => onAnalyzeFile(singleFile)}
          >
            {loading ? "Analyzing…" : "Analyze file"}
          </button>
        </div>
      )}

      {tab === "zip" && (
        <div className="zip-tab">
          <p className="hint">
            Upload a small zipped project (max 5&nbsp;MB, 200 files). Folders like
            node_modules, .git, and .venv are skipped automatically.
          </p>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
          />
          <button
            className="primary-btn"
            disabled={loading || !zipFile}
            onClick={() => onAnalyzeFile(zipFile)}
          >
            {loading ? "Analyzing…" : "Analyze repo"}
          </button>
        </div>
      )}
    </div>
  );
}
