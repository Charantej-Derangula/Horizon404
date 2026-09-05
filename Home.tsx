/** Quiet Observatory: a dense, composed instrument-panel workbench with Horizon Blue signals and the editor/output pair as the strongest visual objects. */
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3, BookOpenText, Braces, Check, ChevronDown, ChevronRight, Circle, Code2,
  Copy, Download, FileCode2, FileText, FolderArchive, FolderSearch, History,
  Home as HomeIcon, Loader2, MessageSquareText, Network, PanelLeftClose, PanelLeftOpen,
  Plus, Search, Settings2, Sparkles, Trash2, Upload, WandSparkles,
} from "lucide-react";
import { analyzeFile, analyzeSnippet, explainCode, generateDocs, generateReadme, getHealth } from "@/lib/horizonApi";
import type { AnalyzeResponse, DocstringResponse, ExplainResponse, FileNode, FunctionInfo, Language, ReadmeResponse } from "@/lib/horizonTypes";

const HERO_IMAGE = "/manus-storage/horizon-hero-observatory_a1e4ee99.png";
const ORBIT_IMAGE = "/manus-storage/horizon-analysis-orbit_1b79ac90.png";
const UPLOAD_IMAGE = "/manus-storage/horizon-upload-surface_77613e7e.png";
const LOGO_IMAGE = "/manus-storage/horizon-mark_7596e7ab.png";

const INITIAL_CODE = `def normalize_records(records, allowed_statuses):
    out = []
    for record in records:
        if record.get("status") in allowed_statuses:
            cleaned = {key: value for key, value in record.items() if value is not None}
            cleaned["name"] = cleaned.get("name", "").strip().title()
            out.append(cleaned)
    return out
`;

const languageOptions: { value: "auto" | Language; label: string; extension: string }[] = [
  { value: "auto", label: "Auto detect", extension: "py" },
  { value: "python", label: "Python", extension: "py" },
  { value: "javascript", label: "JavaScript", extension: "js" },
  { value: "java", label: "Java", extension: "java" },
  { value: "cpp", label: "C++", extension: "cpp" },
];

const navItems = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "write", label: "Write Code", icon: Code2 },
  { id: "docs", label: "Documentation", icon: BookOpenText },
  { id: "explain", label: "Explain Code", icon: MessageSquareText },
  { id: "analysis", label: "Project Analysis", icon: BarChart3 },
  { id: "upload", label: "Upload Project", icon: FolderArchive },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

type NavId = (typeof navItems)[number]["id"];
type OutputTab = "docs" | "explain" | "readme" | "analysis";

function byteLabel(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function outputFilename(tab: OutputTab, file: FileNode | null) {
  if (tab === "readme") return "README.md";
  if (tab === "docs") return `documented-${file?.path?.split("/").pop() || "code"}`;
  return tab === "explain" ? "code-explanation.md" : "project-analysis.md";
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState<NavId>("home");
  const [code, setCode] = useState(INITIAL_CODE);
  const [filename, setFilename] = useState("records.py");
  const [languageChoice, setLanguageChoice] = useState<"auto" | Language>("auto");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [outputTab, setOutputTab] = useState<OutputTab>("docs");
  const [docs, setDocs] = useState<DocstringResponse | null>(null);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [explainTarget, setExplainTarget] = useState<FunctionInfo | null>(null);
  const [readme, setReadme] = useState<ReadmeResponse | null>(null);
  const [historyItems, setHistoryItems] = useState<string[]>([]);
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);
  const [health, setHealth] = useState<"checking" | "ready" | "offline">("checking");
  const [liveMode, setLiveMode] = useState<"live" | "mock" | null>(null);
  const [busy, setBusy] = useState<"analyze" | "docs" | "explain" | "readme" | null>(null);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeFile = analysis?.files?.[activeFileIndex] || null;
  const allFunctions = useMemo(() => analysis?.files.flatMap((file) => file.functions) || [], [analysis]);
  const documentedCount = allFunctions.filter((fn) => fn.has_docstring).length;
  const documentationScore = allFunctions.length ? Math.round((documentedCount / allFunctions.length) * 100) : 0;
  const filteredFunctions = activeFile?.functions.filter((fn) => fn.name.toLowerCase().includes(query.toLowerCase())) || [];

  useEffect(() => {
    getHealth()
      .then((data) => { setHealth("ready"); setLiveMode(data.llm_mode); })
      .catch(() => setHealth("offline"));
  }, []);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const clearOutputs = () => {
    setDocs(null);
    setExplanation(null);
    setExplainTarget(null);
    setReadme(null);
  };

  const applyAnalysis = (result: AnalyzeResponse, uploaded?: File) => {
    const firstUsable = result.files.findIndex((file) => !file.skipped);
    const nextIndex = firstUsable >= 0 ? firstUsable : 0;
    const nextFile = result.files[nextIndex];
    setAnalysis(result);
    setActiveFileIndex(nextIndex);
    setSelectedIds(new Set(nextFile?.functions.map((fn) => fn.id) || []));
    setPendingUpload(uploaded || null);
    setLiveMode(result.llm_mode);
    setHistoryItems((previous) => [`${uploaded?.name || filename} · ${result.files.filter((file) => !file.skipped).length} file${result.files.length === 1 ? "" : "s"}`, ...previous].slice(0, 5));
    clearOutputs();
    setOutputTab("analysis");
  };

  const runAnalysis = async (file?: File) => {
    setBusy("analyze");
    try {
      const result = file ? await analyzeFile(file) : await analyzeSnippet(code, filename);
      applyAnalysis(result, file);
      toast.success(file ? "Project structure mapped." : "Code structure mapped.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to analyze this input.");
    } finally {
      setBusy(null);
    }
  };

  const selectUpload = (file: File | undefined) => {
    if (!file) return;
    const isZip = file.name.toLowerCase().endsWith(".zip");
    if (file.size > (isZip ? 5_000_000 : 300_000)) {
      toast.error(isZip ? "ZIP files are limited to 5 MB." : "Source files are limited to 300 KB.");
      return;
    }
    void runAnalysis(file);
  };

  const chooseLanguage = (value: "auto" | Language) => {
    setLanguageChoice(value);
    const option = languageOptions.find((item) => item.value === value);
    if (value !== "auto" && option) setFilename(`snippet.${option.extension}`);
  };

  const resetEditor = () => {
    setCode("");
    setFilename("snippet.py");
    setLanguageChoice("auto");
    setPendingUpload(null);
    setAnalysis(null);
    setSelectedIds(new Set());
    clearOutputs();
    setOutputTab("docs");
  };

  const handleNavigation = (id: NavId) => {
    setActiveNav(id);
    if (id === "home") window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "write") { resetEditor(); workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (id === "docs") { setOutputTab("docs"); workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (id === "explain") { setOutputTab("explain"); workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (id === "analysis") { setOutputTab("analysis"); analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    if (id === "upload") zipInputRef.current?.click();
    if (id === "settings") setSettingsOpen((open) => !open);
    if (id === "history") toast.info(historyItems.length ? "Recent sessions are listed below." : "Your completed analyses will appear here.");
  };

  const toggleFunction = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateActiveFile = (index: number) => {
    const next = analysis?.files[index];
    setActiveFileIndex(index);
    setSelectedIds(new Set(next?.functions.map((fn) => fn.id) || []));
    setDocs(null);
  };

  const documentSelected = async () => {
    if (!activeFile?.language) return toast.error("Choose a supported source file first.");
    const functions = activeFile.functions.filter((fn) => selectedIds.has(fn.id));
    if (!functions.length) return toast.error("Select at least one function to document.");
    setBusy("docs");
    setOutputTab("docs");
    try {
      const result = await generateDocs(activeFile.language, functions, analysis?.mode === "repo" ? undefined : code);
      setDocs(result);
      setLiveMode(result.llm_mode);
      toast.success(`Documentation generated for ${functions.length} selected item${functions.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Documentation could not be generated.");
    } finally {
      setBusy(null);
    }
  };

  const explainFunction = async (fn: FunctionInfo) => {
    if (!activeFile?.language) return;
    setExplainTarget(fn);
    setOutputTab("explain");
    setBusy("explain");
    try {
      const result = await explainCode(activeFile.language, fn.code, fn.name);
      setExplanation(result);
      setLiveMode(result.llm_mode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This function could not be explained.");
    } finally {
      setBusy(null);
    }
  };

  const createReadme = async () => {
    if (!analysis) return toast.error("Analyze a file or project before creating its README.");
    setOutputTab("readme");
    setBusy("readme");
    try {
      const projectName = pendingUpload?.name.replace(/\.zip$/i, "") || filename.replace(/\.[^.]+$/, "") || "Horizon Project";
      const result = await generateReadme(projectName, analysis.files);
      setReadme(result);
      setLiveMode(result.llm_mode);
      toast.success("README draft prepared from the inspected structure.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "README generation could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  const currentOutput = useMemo(() => {
    if (outputTab === "docs") return docs?.updated_code || docs?.results.map((item) => `### ${item.name}\n\n${item.docstring}`).join("\n\n") || "";
    if (outputTab === "readme") return readme?.readme_markdown || "";
    if (outputTab === "explain") return explanation ? `# ${explainTarget?.name || "Function"}\n\n## Purpose\n${explanation.purpose}\n\n## Inputs\n${explanation.inputs}\n\n## Outputs\n${explanation.outputs}\n\n## Logic flow\n${explanation.logic_flow}` : "";
    return analysis ? `# Project analysis\n\nFiles analyzed: ${analysis.files.filter((file) => !file.skipped).length}\nFunctions discovered: ${allFunctions.length}\nExisting documentation coverage: ${documentationScore}%\nLLM mode: ${analysis.llm_mode}` : "";
  }, [allFunctions.length, analysis, docs, documentationScore, explainTarget?.name, explanation, outputTab, readme]);

  const copyOutput = async () => {
    if (!currentOutput) return;
    await navigator.clipboard.writeText(currentOutput).then(() => toast.success("Copied to clipboard.")).catch(() => toast.error("Clipboard access is unavailable in this browser."));
  };

  const downloadOutput = () => {
    if (!currentOutput) return;
    const blob = new Blob([currentOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = outputFilename(outputTab, activeFile);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="horizon-shell">
      <aside className={`horizon-sidebar ${sidebarOpen ? "" : "is-collapsed"}`} aria-label="Primary navigation">
        <div className="sidebar-header">
          <div className="brand-lockup">
            <img src={LOGO_IMAGE} alt="Horizon" className="brand-mark" />
            {sidebarOpen && <span className="brand-wordmark">HORIZON</span>}
          </div>
          <button className="icon-button sidebar-toggle" aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} onClick={() => setSidebarOpen((open) => !open)}>
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => handleNavigation(id)} className={`nav-item ${activeNav === id ? "active" : ""}`} title={!sidebarOpen ? label : undefined}>
              <Icon size={17} strokeWidth={1.8} />
              {sidebarOpen && <span>{label}</span>}
              {sidebarOpen && id === "upload" && <ChevronRight className="nav-chevron" size={14} />}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-footer">
            <div className="footer-mark"><img src={LOGO_IMAGE} alt="" /></div>
            <div><strong>HORIZON</strong><span>AI-powered developer toolkit</span></div>
          </div>
        )}
      </aside>

      <main className="horizon-main">
        <header className="topbar">
          <div className="command-search">
            <Search size={16} />
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search functions or press ⌘ K" aria-label="Search discovered functions" />
            <kbd>⌘ K</kbd>
          </div>
          <div className={`ai-status ${health}`}>
            <Circle size={8} fill="currentColor" strokeWidth={0} />
            <span>{health === "checking" ? "Checking AI" : health === "ready" ? liveMode === "live" ? "AI configured" : "Fallback mode" : "Backend offline"}</span>
          </div>
          <div className="user-dot" title="Local workspace">H</div>
        </header>

        <div className="content-frame">
          <section className="hero-panel" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 13, 25, .95) 0%, rgba(8, 13, 25, .80) 58%, rgba(8, 13, 25, .22) 100%), url(${HERO_IMAGE})` }}>
            <div className="eyebrow"><Sparkles size={14} /> SOURCE ANALYSIS INSTRUMENT</div>
            <h1>Turn Your Code into <span>Clarity</span></h1>
            <p>Detect language and structure, select functions, then generate documentation, explanations, and a project README from the source you provide.</p>
          </section>

          <section className="capability-strip" aria-label="Horizon capabilities">
            {[
              [Braces, "Multiple Languages"], [Upload, "File / ZIP Upload"], [Network, "Smart Analysis"],
              [FileText, "Clean Documentation"], [WandSparkles, "Built for Developers"],
            ].map(([Icon, label]) => {
              const CapabilityIcon = Icon as typeof Braces;
              return <div key={label as string} className="capability-chip"><CapabilityIcon size={14} /><span>{label as string}</span></div>;
            })}
          </section>

          <section ref={workspaceRef} className="workspace-grid" aria-label="Horizon documentation workspace">
            <div className="workbench-panel input-panel">
              <div className="panel-title-row">
                <div><div className="section-kicker"><Code2 size={15} /> Code Input</div><p>Paste your code, upload a file, or upload a project.</p></div>
                <div className="language-select-wrap"><span>Language</span><select value={languageChoice} onChange={(event) => chooseLanguage(event.target.value as "auto" | Language)}><option value="auto">Auto detect</option><option value="python">Python</option><option value="javascript">JavaScript</option><option value="java">Java</option><option value="cpp">C++</option></select><ChevronDown size={13} /></div>
              </div>

              <div className="input-actions">
                <button className="compact-action active" onClick={() => { setPendingUpload(null); workspaceRef.current?.scrollIntoView({ behavior: "smooth" }); }}><Code2 size={14} /> Paste Code</button>
                <button className="compact-action" onClick={() => fileInputRef.current?.click()}><FileCode2 size={14} /> Upload File</button>
                <button className="compact-action" onClick={() => zipInputRef.current?.click()}><FolderArchive size={14} /> Upload Project <span>(.zip)</span></button>
                <button className="compact-action clear" onClick={resetEditor}><Trash2 size={14} /> Clear</button>
                <input ref={fileInputRef} type="file" className="sr-only" accept=".py,.js,.jsx,.mjs,.ts,.tsx,.java,.cpp,.cc,.cxx,.c,.h,.hpp" onChange={(event) => { selectUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                <input ref={zipInputRef} type="file" className="sr-only" accept=".zip" onChange={(event) => { selectUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              </div>

              <div className="editor-meta"><input value={filename} onChange={(event) => setFilename(event.target.value)} aria-label="Source filename" /><span>{pendingUpload ? `Ready to analyze ${pendingUpload.name}` : "Session-only workspace"}</span></div>
              <div className="editor-shell" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectUpload(event.dataTransfer.files[0]); }}>
                <Editor height="342px" language={languageChoice === "auto" ? "python" : languageChoice === "cpp" ? "cpp" : languageChoice} theme="vs-dark" value={code} onChange={(value) => setCode(value || "")} options={{ minimap: { enabled: false }, fontSize: 13, lineHeight: 21, fontFamily: "IBM Plex Mono, monospace", padding: { top: 14, bottom: 14 }, scrollBeyondLastLine: false, automaticLayout: true, cursorBlinking: "smooth" }} />
                <div className="drop-helper"><Upload size={13} /> Drop a file or project anywhere here</div>
              </div>
              <div className="input-footer">
                <span><Circle size={7} fill="#75A7FF" strokeWidth={0} /> {activeFile?.language ? `${activeFile.language} detected` : "Ready for supported source"}</span>
                <button disabled={busy === "analyze" || (!code.trim() && !pendingUpload)} className="primary-action" onClick={() => void runAnalysis(pendingUpload || undefined)}>
                  {busy === "analyze" ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {busy === "analyze" ? "Mapping code…" : "Analyze code"}
                </button>
              </div>
            </div>

            <div className="workbench-panel output-panel">
              <div className="panel-title-row output-header">
                <div><div className="section-kicker"><WandSparkles size={15} /> AI Output</div><p>{analysis ? "Inspectable, export-ready documentation." : "Your generated results will appear here."}</p></div>
                {analysis && <button className="primary-action small" disabled={busy === "docs"} onClick={() => void documentSelected()}>{busy === "docs" ? <Loader2 size={14} className="spin" /> : <WandSparkles size={14} />} Generate Docs</button>}
              </div>
              <div className="output-tabs">
                {(["docs", "explain", "readme", "analysis"] as OutputTab[]).map((tab) => <button key={tab} onClick={() => setOutputTab(tab)} className={outputTab === tab ? "active" : ""}>{tab === "docs" ? "Documentation" : tab === "explain" ? "Explain Code" : tab === "readme" ? "README" : "Analysis"}</button>)}
                <span className="tab-spacer" />
                <button className="icon-button" disabled={!currentOutput} onClick={() => void copyOutput()} aria-label="Copy output"><Copy size={15} /></button>
                <button className="icon-button" disabled={!currentOutput} onClick={downloadOutput} aria-label="Download output"><Download size={15} /></button>
              </div>
              <div className="output-body">
                {outputTab === "analysis" && <AnalysisView analysis={analysis} score={documentationScore} functionCount={allFunctions.length} image={ORBIT_IMAGE} onGenerateReadme={() => void createReadme()} loading={busy === "readme"} />}
                {outputTab === "docs" && <DocsView docs={docs} language={activeFile?.language} loading={busy === "docs"} />}
                {outputTab === "explain" && <ExplainView target={explainTarget} result={explanation} loading={busy === "explain"} />}
                {outputTab === "readme" && <ReadmeView readme={readme} loading={busy === "readme"} onGenerate={() => void createReadme()} />}
              </div>
            </div>
          </section>

          <section ref={analysisRef} className="analysis-section">
            <div className="analysis-title"><div><div className="section-kicker"><FolderSearch size={15} /> Structural Map</div><p>{analysis ? `${analysis.files.filter((file) => !file.skipped).length} source file${analysis.files.filter((file) => !file.skipped).length === 1 ? "" : "s"} inspected` : "Analyze a file or project to reveal its structure."}</p></div>{analysis && <div className="metrics"><Metric label="Files" value={analysis.files.filter((file) => !file.skipped).length} /><Metric label="Functions" value={allFunctions.length} /><Metric label="Doc health" value={`${documentationScore}%`} /></div>}</div>
            {analysis ? <div className="structure-grid">
              <div className="file-list">{analysis.files.map((file, index) => <button key={`${file.path}-${index}`} onClick={() => updateActiveFile(index)} className={`file-row ${activeFileIndex === index ? "active" : ""} ${file.skipped ? "skipped" : ""}`}><FileCode2 size={15} /><div><strong>{file.path}</strong><span>{file.skipped ? file.skip_reason : `${file.language} · ${file.functions.length} item${file.functions.length === 1 ? "" : "s"} · ${byteLabel(file.size_bytes)}`}</span></div>{activeFileIndex === index && <ChevronRight size={15} />}</button>)}</div>
              <div className="function-list"><div className="function-list-header"><span>{activeFile?.path || "Functions"}</span><button onClick={() => setSelectedIds(new Set(activeFile?.functions.map((fn) => fn.id) || []))}>Select all</button></div>{filteredFunctions.length ? filteredFunctions.map((fn) => <div className="function-row" key={fn.id}><label><input type="checkbox" checked={selectedIds.has(fn.id)} onChange={() => toggleFunction(fn.id)} /><span className={`kind-dot ${fn.kind}`} /><div><strong>{fn.name}</strong><small>{fn.params.length ? `(${fn.params.join(", ")})` : fn.kind}</small></div></label><button className="explain-button" onClick={() => void explainFunction(fn)}>Explain</button></div>) : <div className="empty-functions">{query ? "No functions match your search." : "No functions were found in this source file."}</div>}</div>
            </div> : <div className="upload-discovery" style={{ backgroundImage: `linear-gradient(90deg, rgba(14, 21, 36, .96), rgba(14, 21, 36, .72)), url(${UPLOAD_IMAGE})` }}><FolderArchive size={23} /><div><strong>Drop a small repository here to map its source files.</strong><span>Horizon safely ignores dependency folders and unsupported files.</span></div><button className="compact-action" onClick={() => zipInputRef.current?.click()}><Upload size={14} /> Upload ZIP</button></div>}
            {analysis?.warnings.map((warning) => <div key={warning} className="warning-note">{warning}</div>)}
          </section>

          {historyItems.length > 0 && <section className="history-section"><div className="section-kicker"><History size={15} /> Recent local sessions</div><div>{historyItems.map((item) => <span key={item}>{item}</span>)}</div></section>}
        </div>
      </main>

      {settingsOpen && <aside className="settings-drawer"><div><strong>Workspace settings</strong><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div><p>Horizon keeps your work in the active browser session. Configure <code>VITE_HORIZON_API_URL</code> to point this workspace at the FastAPI service.</p><span className="mode-note">Current connection: {health === "ready" ? `${liveMode === "live" ? "live AI" : "template fallback"} mode` : "not connected"}</span></aside>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function AnalysisView({ analysis, score, functionCount, image, onGenerateReadme, loading }: { analysis: AnalyzeResponse | null; score: number; functionCount: number; image: string; onGenerateReadme: () => void; loading: boolean }) {
  if (!analysis) return <EmptyOutput image={image} title="Your project map begins here" text="Analyze a code snippet, source file, or small ZIP repository to reveal language, functions, coverage, and documentation opportunities." />;
  const languages = Array.from(new Set(analysis.files.filter((file) => !file.skipped).map((file) => file.language).filter(Boolean))).join(" · ");
  return <div className="analysis-output"><div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><strong>{score}</strong><span>DOC HEALTH</span></div><div className="analysis-copy"><h3>{functionCount} documented opportunities found</h3><p>Horizon inspected {analysis.files.filter((file) => !file.skipped).length} supported files in {analysis.mode === "repo" ? "this project" : "this source"}. Languages detected: {languages || "none"}.</p><div className="analysis-tags"><span><Check size={13} /> Structure parsed</span><span><Check size={13} /> Output ready</span><span>{analysis.llm_mode === "live" ? "Live AI connected" : "Template fallback available"}</span></div><button className="secondary-action" disabled={loading} onClick={onGenerateReadme}>{loading ? <Loader2 className="spin" size={14} /> : <FileText size={14} />} Generate project README</button></div></div>;
}

function DocsView({ docs, language, loading }: { docs: DocstringResponse | null; language?: Language | null; loading: boolean }) {
  if (loading) return <LoadingOutput label="Drafting conventions-aware documentation" />;
  if (!docs) return <EmptyOutput title="Documentation built from parsed structure" text={`Select functions in the structural map, then generate ${language === "python" ? "Google-style Python docstrings" : language === "javascript" ? "JSDoc comments" : "documentation aligned to the detected language"}.`} />;
  if (docs.updated_code) return <div className="generated-code"><div className="generated-label"><Check size={14} /> Documentation inserted into source <span>{docs.llm_mode === "live" ? "AI generated" : "Template fallback"}</span></div><Editor height="330px" language={language === "cpp" ? "cpp" : language || "plaintext"} theme="vs-dark" value={docs.updated_code} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12.5, lineHeight: 20, fontFamily: "IBM Plex Mono, monospace", scrollBeyondLastLine: false, automaticLayout: true }} /></div>;
  return <div className="doc-list">{docs.results.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.style}</span></div><pre>{item.docstring}</pre></article>)}</div>;
}

function ExplainView({ target, result, loading }: { target: FunctionInfo | null; result: ExplainResponse | null; loading: boolean }) {
  if (loading) return <LoadingOutput label="Translating implementation into plain English" />;
  if (!result || !target) return <EmptyOutput title="A clear walkthrough for every function" text="Choose Explain beside any parsed function to get its purpose, inputs, outputs, and logic flow in plain English." />;
  return <div className="explain-output"><div className="explain-name"><MessageSquareText size={16} /><strong>{target.name}</strong><code>lines {target.start_line}–{target.end_line}</code></div>{[["Purpose", result.purpose], ["Inputs", result.inputs], ["Outputs", result.outputs], ["Logic flow", result.logic_flow]].map(([label, text]) => <section key={label}><span>{label}</span><p>{text}</p></section>)}</div>;
}

function ReadmeView({ readme, loading, onGenerate }: { readme: ReadmeResponse | null; loading: boolean; onGenerate: () => void }) {
  if (loading) return <LoadingOutput label="Building a README from the verified project structure" />;
  if (!readme) return <EmptyOutput title="A README grounded in your actual project" text="Horizon uses the analyzed file structure and discovered functions to draft setup, purpose, and use guidance." action="Generate README" onAction={onGenerate} />;
  return <div className="readme-output"><div className="generated-label"><Check size={14} /> README.md <span>{readme.llm_mode === "live" ? "AI generated" : "Template fallback"}</span></div><pre>{readme.readme_markdown}</pre></div>;
}

function EmptyOutput({ title, text, image, action, onAction }: { title: string; text: string; image?: string; action?: string; onAction?: () => void }) { return <div className="empty-output" style={image ? { backgroundImage: `linear-gradient(90deg, rgba(13, 20, 34, .98), rgba(13, 20, 34, .75)), url(${image})` } : undefined}><div className="empty-icon"><Sparkles size={20} /></div><h3>{title}</h3><p>{text}</p>{action && <button className="secondary-action" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>; }
function LoadingOutput({ label }: { label: string }) { return <div className="loading-output"><Loader2 className="spin" size={25} /><p>{label}</p><span>Source is inspected before output generation.</span></div>; }
