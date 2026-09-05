import { useState } from "react";
import CodeInputPanel from "./components/CodeInputPanel";
import FunctionList from "./components/FunctionList";
import DocstringsPanel from "./components/DocstringsPanel";
import ExplainPanel from "./components/ExplainPanel";
import ReadmePanel from "./components/ReadmePanel";
import ErrorBanner from "./components/ErrorBanner";
import { analyzeSnippet, analyzeFile, generateDocstrings, explainFunction, generateReadme } from "./api";
import "./styles.css";

const OUTPUT_TABS = ["docstrings", "explain", "readme"];

export default function App() {
  const [analysis, setAnalysis] = useState(null); // AnalyzeResponse
  const [rawCode, setRawCode] = useState(null); // original source text, for snippet/single-file mode only
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [selectedFunctionIds, setSelectedFunctionIds] = useState(new Set());

  const [outputTab, setOutputTab] = useState("docstrings");

  const [docstringResult, setDocstringResult] = useState(null);
  const [docstringsLoading, setDocstringsLoading] = useState(false);

  const [explainTarget, setExplainTarget] = useState(null);
  const [explainResult, setExplainResult] = useState(null);
  const [explainLoadingId, setExplainLoadingId] = useState(null);

  const [readmeResult, setReadmeResult] = useState(null);
  const [readmeLoading, setReadmeLoading] = useState(false);

  const resetOutputs = () => {
    setDocstringResult(null);
    setExplainTarget(null);
    setExplainResult(null);
    setReadmeResult(null);
    setSelectedFunctionIds(new Set());
  };

  const handleAnalysisResult = (result) => {
    setAnalysis(result);
    const firstUsable = result.files.findIndex((f) => !f.skipped);
    setSelectedFileIndex(firstUsable === -1 ? 0 : firstUsable);
    resetOutputs();
  };

  const handleAnalyzeSnippet = async (code, filename) => {
    setAnalyzeLoading(true);
    setError(null);
    try {
      const result = await analyzeSnippet(code, filename);
      handleAnalysisResult(result);
      setRawCode(code);
    } catch (e) {
      setError(e.message);
      setAnalysis(null);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handleAnalyzeFile = async (file) => {
    setAnalyzeLoading(true);
    setError(null);
    try {
      const result = await analyzeFile(file);
      handleAnalysisResult(result);
      if (result.mode === "file") {
        setRawCode(await file.text());
      } else {
        setRawCode(null); // repo/zip mode: no single blob to splice into
      }
    } catch (e) {
      setError(e.message);
      setAnalysis(null);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const currentFile = analysis?.files?.[selectedFileIndex] ?? null;

  const handleSelectFile = (idx) => {
    setSelectedFileIndex(idx);
    setSelectedFunctionIds(new Set());
    setDocstringResult(null);
  };

  const handleToggleFunction = (id) => {
    setSelectedFunctionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (file, checked) => {
    setSelectedFunctionIds(checked ? new Set(file.functions.map((f) => f.id)) : new Set());
  };

  const handleGenerateDocstrings = async () => {
    if (!currentFile) return;
    setDocstringsLoading(true);
    setError(null);
    setOutputTab("docstrings");
    try {
      const functions = currentFile.functions.filter((f) => selectedFunctionIds.has(f.id));
      // Splicing docstrings back into the original source only makes sense
      // for single-file/snippet mode (one coherent source blob); for a repo
      // upload we show a per-function docstring list instead.
      const result = await generateDocstrings({
        language: currentFile.language,
        functions,
        fullCode: analysis.mode !== "repo" ? rawCode ?? undefined : undefined,
      });
      setDocstringResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setDocstringsLoading(false);
    }
  };

  const handleExplain = async (fn) => {
    setExplainTarget(fn);
    setExplainResult(null);
    setExplainLoadingId(fn.id);
    setError(null);
    setOutputTab("explain");
    try {
      const result = await explainFunction({
        language: currentFile.language,
        code: fn.code,
        functionName: fn.name,
      });
      setExplainResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setExplainLoadingId(null);
    }
  };

  const handleGenerateReadme = async () => {
    if (!analysis) return;
    setReadmeLoading(true);
    setError(null);
    setOutputTab("readme");
    try {
      const result = await generateReadme({
        projectName: analysis.mode === "repo" ? "My Project" : currentFile?.path ?? "My Project",
        files: analysis.files,
      });
      setReadmeResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setReadmeLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI-Powered Code Documentation Generator</h1>
        <p className="subtitle">
          Paste code, upload a file, or upload a small zipped project — get docstrings, plain-English
          explanations, and a README, generated by an LLM.
        </p>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <main className="app-main">
        <section className="input-column">
          <CodeInputPanel
            detectedLanguage={currentFile?.language}
            onAnalyzeSnippet={handleAnalyzeSnippet}
            onAnalyzeFile={handleAnalyzeFile}
            loading={analyzeLoading}
          />

          {analysis && (
            <FunctionList
              files={analysis.files}
              selectedFileIndex={selectedFileIndex}
              onSelectFile={handleSelectFile}
              selectedFunctionIds={selectedFunctionIds}
              onToggleFunction={handleToggleFunction}
              onSelectAll={handleSelectAll}
              onGenerateDocstrings={handleGenerateDocstrings}
              onExplain={handleExplain}
              docstringsLoading={docstringsLoading}
              explainLoadingId={explainLoadingId}
            />
          )}

          {analysis?.warnings?.length > 0 && (
            <div className="panel warnings-panel">
              {analysis.warnings.map((w, i) => (
                <p key={i} className="inline-warning">{w}</p>
              ))}
            </div>
          )}
        </section>

        <section className="output-column">
          <div className="panel">
            <div className="tabs">
              {OUTPUT_TABS.map((t) => (
                <button
                  key={t}
                  className={outputTab === t ? "tab active" : "tab"}
                  onClick={() => setOutputTab(t)}
                >
                  {t === "docstrings" ? "Docstrings" : t === "explain" ? "Explain function" : "README"}
                </button>
              ))}
            </div>

            {outputTab === "docstrings" && (
              <DocstringsPanel result={docstringResult} language={currentFile?.language} />
            )}
            {outputTab === "explain" && <ExplainPanel target={explainTarget} result={explainResult} />}
            {outputTab === "readme" && (
              <ReadmePanel
                result={readmeResult}
                onGenerate={handleGenerateReadme}
                loading={readmeLoading}
                canGenerate={!!analysis}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
