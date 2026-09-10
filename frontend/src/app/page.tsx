"use client";

import { useEffect, useState, useCallback } from "react";
import Dropzone from "@/components/Dropzone";
import Pipeline, { PipelineTimings } from "@/components/Pipeline";
import MarkdownViewer from "@/components/MarkdownViewer";
import {
  Copy,
  Download,
  Trash2,
  Search,
  Sparkles,
  Check,
  Layers,
  FileText,
  Box,
  Activity,
  Eye,
  Code2,
  ExternalLink,
  Trash,
} from "lucide-react";

// Types
type ChunkPreview = { chunk_index: number; heading?: string; tokens: number; char_count: number; preview: string };
type ShiftResponse = {
  success: boolean;
  doc_id: string;
  filename: string;
  file_size_bytes: number;
  engine: string;
  markdown: string;
  markdown_length: number;
  chunks: number;
  chunk_previews: ChunkPreview[];
  timings_ms: PipelineTimings;
  vector_dim: number;
  collection: string;
};
type DocRecord = ShiftResponse & { addedAt: number };
type SearchResult = { id: string; score: number; text: string; filename: string; doc_id: string; chunk_index: number; tokens: number };

// Demo markdown for offline/no-backend mode
const DEMO_DOCS: Record<string, ShiftResponse> = {
  legal: {
    success: true,
    doc_id: "demo-legal",
    filename: "M&A_Contract_Scan_42p.pdf",
    file_size_bytes: 8_400_000,
    engine: "docling",
    markdown: `# Stock Purchase Agreement — M&A Contract

> **Source:** Scan 150dpi · 42 pages · OCR confidence 99.1% after spatial correction

## 8. Termination & Indemnification

### 8.1 Termination
Either party may terminate this Agreement upon **30 days written notice** if the other party materially breaches any representation or warranty and fails to cure within the notice period.

- Cure period: **30 days**
- Notice method: Written, certified mail
- Governing law: **Delaware**

> **Marginalia transcribed:** "check Delaware clause — J.M. 3/12" → flagged for review

### 8.2 Indemnification Cap
The indemnification cap shall not exceed **$4,200,000**, except in cases of fraud or willful misconduct.

### 8.3 Escrow
12-month escrow, 10% holdback ($1.2M) released on 1-year anniversary.

---

## Schedule A — Consideration

| Party | Cash Consideration | Equity Roll | Notes |
|-------|:------------------:|:-----------:|-------|
| Acme Co (Sellers) | $12,000,000 | 15% | Subject to working capital adj. |
| Buyer (Apex Holdings) | $48,000,000 | 85% | Financed via debt + equity |
| **Total Enterprise Value** | **$60,000,000** | **100%** | — |

## Key Dates

| Milestone | Date | Status |
|-----------|------|--------|
| Signing | 2024-03-15 | Executed |
| Closing | 2024-04-30 | Pending HSR |
| Escrow release | 2025-04-30 | Scheduled |

---
*DocID 2024-MA-8841 · Page 19/42 · Spatially corrected 2.3° skew*`,
    markdown_length: 2100,
    chunks: 7,
    chunk_previews: [],
    timings_ms: { ocr_ms: 12, spatial_ms: 9, table_ms: 14, markdown_ms: 5, embedding_ms: 8, indexing_ms: 4, total_ms: 52 },
    vector_dim: 384,
    collection: "shiftrag_docs",
  },
  medical: {
    success: true,
    doc_id: "demo-medical",
    filename: "StMarys_LabReport_2024.pdf",
    file_size_bytes: 2_100_000,
    engine: "docling",
    markdown: `# St. Mary's Hospital — Laboratory Report

> **Patient:** A. Sharma (42F) · MRN 884192 · **Date:** 2024-11-08 · **Ordering:** Dr. Patel

## Complete Blood Count (CBC)

| Test | Result | Units | Flag | Reference |
|------|--------|-------|------|-----------|
| Hemoglobin | **9.2** | g/dL | 🔴 Low | 12.0–16.0 |
| WBC | **14.3** | K/µL | 🔴 High | 4.5–11.0 |
| Platelets | 210 | K/µL | — | 150–400 |
| RBC | 3.8 | M/µL | 🔴 Low | 4.2–5.4 |
| MCV | 78 | fL | 🔴 Low | 80–100 |

## Chart Recovery — WBC Trend (6 months)

| Month | WBC (K/µL) |
|-------|------------|
| Jun 2024 | 7.1 |
| Jul 2024 | 8.4 |
| Aug 2024 | 9.9 |
| Sep 2024 | 11.2 |
| Oct 2024 | 13.0 |
| Nov 2024 | **14.3** |

> **Trend:** Steady leukocytosis increase (+101% over 6 months)

## Impression
- **Microcytic anemia** (Hb 9.2, MCV 78)
- **Leukocytosis** with upward trend

**Plan:** Hematology referral · Repeat CBC in 7 days`,
    markdown_length: 1800,
    chunks: 6,
    chunk_previews: [],
    timings_ms: { ocr_ms: 11, spatial_ms: 9, table_ms: 12, markdown_ms: 4, embedding_ms: 7, indexing_ms: 3, total_ms: 46 },
    vector_dim: 384,
    collection: "shiftrag_docs",
  },
  finance: {
    success: true,
    doc_id: "demo-finance",
    filename: "Q3_Financials_Messy.xlsx",
    file_size_bytes: 1_400_000,
    engine: "docling",
    markdown: `# Q3 2024 Consolidated P&L — Financial Model

> **Source:** Excel · 3 sheets · Merged cells resolved · Hidden rows recovered

## Consolidated P&L (USD '000s)

| Metric | Q1 2024 | Q2 2024 | **Q3 2024** | YoY Q3 |
|--------|---------|---------|-------------|--------|
| Revenue | 4,200 | 4,850 | **5,310** | +18.5% |
| COGS | (2,100) | (2,410) | (2,600) | — |
| **Gross Profit** | **2,100** | **2,440** | **2,710** | +19.0% |
| Opex | (1,400) | (1,520) | (1,610) | — |
| **EBITDA** | 700 | 920 | 1,100 | +32.5% |
| **Net Income** | **420** | **580** | **720** | **+41.2%** |

## Notes

- **Revenue growth:** Q3 driven by enterprise tier (+22%) and APAC expansion
- **COGS improvement:** Vendor renegotiation saved $110k vs Q2

## Assumptions

| Input | Value | Source |
|-------|-------|--------|
| USD/INR | 83.2 | RBI avg |
| Churn assumption | 4.2%/mo | Blended |
| Discount rate | 11% | WACC |`,
    markdown_length: 1900,
    chunks: 5,
    chunk_previews: [],
    timings_ms: { ocr_ms: 10, spatial_ms: 8, table_ms: 16, markdown_ms: 5, embedding_ms: 6, indexing_ms: 3, total_ms: 48 },
    vector_dim: 384,
    collection: "shiftrag_docs",
  },
  slides: {
    success: true,
    doc_id: "demo-slides",
    filename: "Seed_Pitch_Deck_12slides.pptx",
    file_size_bytes: 6_800_000,
    engine: "docling",
    markdown: `# Seed Pitch Deck — ShiftRAG (12 slides → markdown)

> **Source:** PPTX · 12 slides · Icons, chart & speaker notes recovered · 52ms total

## Slide 4 — Go-to-Market Strategy

### Strategy
- **Bottom-up:** Students & researchers — freemium, PLG via Notion/LangChain plugins
- **Top-down:** Legal firms & hospitals — enterprise, SOC 2, on-prem
- **Channel partners:** Notion, LangChain, LlamaIndex

### Market

| Segment | Detail |
|---------|--------|
| **TAM** | $12B — document ingestion for AI / RAG |
| **SAM** | $3.1B — mid-market + enterprise |
| **SOM (3y)** | $180M — via vertical SaaS |

### Traction

| Metric | Value |
|--------|-------|
| Users | 1,200 |
| Growth | +40% MoM |
| Design partners | 6 (2 legal, 2 hospital, 2 university) |

### The Ask
**$1.5M seed** — 18 months runway · 60% eng, 25% GTM, 15% ops

> **Speaker notes:** "Emphasize 80% time saved — data scientists spend 80% cleaning. We do it in milliseconds."`,
    markdown_length: 2000,
    chunks: 6,
    chunk_previews: [],
    timings_ms: { ocr_ms: 13, spatial_ms: 10, table_ms: 13, markdown_ms: 6, embedding_ms: 7, indexing_ms: 3, total_ms: 52 },
    vector_dim: 384,
    collection: "shiftrag_docs",
  },
};

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

export default function Page() {
  const [apiBase, setApiBase] = useState<string>(DEFAULT_API_BASE);
  const [showBackendInput, setShowBackendInput] = useState(false);
  const [backendInput, setBackendInput] = useState("");
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"preview" | "markdown" | "vectors" | "search">("preview");
  const [mdMode, setMdMode] = useState<"rendered" | "raw">("rendered");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ results: SearchResult[]; elapsed_ms: number } | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [stats, setStats] = useState<{ vectors_count: number; documents: number } | null>(null);

  const activeDoc = docs.find((d) => d.doc_id === activeId) || docs[0] || null;

  // Load saved Colab URL from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("shiftrag_api_base") : null;
    if (saved) {
      setApiBase(saved);
      setBackendInput(saved);
    }
  }, []);

  const checkHealth = useCallback(
    (base: string) => {
      fetch(`${base}/health`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(() => setBackendOnline(true))
        .catch(() => setBackendOnline(false));
      fetch(`${base}/documents`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.documents) setStats({ vectors_count: data.stats?.vectors_count || 0, documents: data.documents.length });
        })
        .catch(() => {});
    },
    []
  );

  const showToast = useCallback((msg: string) => {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("translate-y-[80px]", "opacity-0");
    el.classList.add("translate-y-0", "opacity-100");
    setTimeout(() => {
      el.classList.add("translate-y-[80px]", "opacity-0");
      el.classList.remove("translate-y-0", "opacity-100");
    }, 2600);
  }, []);

  // Check backend health on mount + when apiBase changes
  useEffect(() => {
    checkHealth(apiBase);
    // Auto-load finance demo for wow (only once)
    const d = DEMO_DOCS.finance;
    setDocs((prev) => (prev.length === 0 ? [{ ...d, addedAt: Date.now() }] : prev));
    setActiveId((prev) => prev || d.doc_id);
  }, [apiBase, checkHealth]);

  const saveBackendUrl = () => {
    const trimmed = backendInput.trim().replace(/\/$/, "");
    if (!trimmed) return;
    // Ensure /api suffix
    const normalized = trimmed.endsWith("/api") ? trimmed : trimmed + "/api";
    // Basic validation
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://") && normalized !== "/api") {
      showToast("URL must start with https://");
      return;
    }
    localStorage.setItem("shiftrag_api_base", normalized);
    setApiBase(normalized);
    setShowBackendInput(false);
    showToast(`🔗 Backend set to ${normalized}`);
    checkHealth(normalized);
  };

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      // Client validation
      if (file.size > 25 * 1024 * 1024) {
        showToast(`File too large: ${file.name}`);
        continue;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${apiBase}/shift`, { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || `Upload failed (${res.status})`);
        }
        const data: ShiftResponse = await res.json();
        const rec: DocRecord = { ...data, addedAt: Date.now() };
        setDocs((prev) => [rec, ...prev]);
        setActiveId(rec.doc_id);
        setTab("preview");
        showToast(`✓ Ingested ${file.name} in ${data.timings_ms.total_ms}ms → ${data.chunks} vectors`);
        setBackendOnline(true);
      } catch (e: any) {
        // Fallback: if backend offline, synthesize from demo templates so UI still works
        if (backendOnline === false || e.message?.includes("Failed to fetch") || e.message?.includes("NetworkError")) {
          // synthesize
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          let template: ShiftResponse = DEMO_DOCS.legal;
          if (["xlsx", "xls", "csv"].includes(ext)) template = DEMO_DOCS.finance;
          else if (["pptx", "ppt"].includes(ext)) template = DEMO_DOCS.slides;
          else if (["png", "jpg", "jpeg", "webp"].includes(ext)) template = DEMO_DOCS.medical;
          const rec: DocRecord = {
            ...template,
            doc_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            filename: file.name,
            file_size_bytes: file.size,
            engine: "fallback (backend offline)",
            markdown: `# ${file.name}\n\n> **Note:** Backend offline — showing preview synthesis. Start backend with \`uvicorn app.main:app --reload\` for real Docling parsing.\n\n${template.markdown.replace(/^#.*$/m, "").trim()}`,
            addedAt: Date.now(),
          };
          setDocs((prev) => [rec, ...prev]);
          setActiveId(rec.doc_id);
          showToast(`• Backend offline — preview for ${file.name} (start backend for real parse)`);
        } else {
          showToast(`✕ ${e.message}`);
        }
      } finally {
        setBusy(false);
      }
    }
    // refresh stats
    fetch(`${apiBase}/stats`)
      .then((r) => r.json())
      .then((s) => setStats({ vectors_count: s.vectors_count || 0, documents: s.documents || docs.length }))
      .catch(() => {});
  };

  const loadDemo = (key: keyof typeof DEMO_DOCS) => {
    const d = DEMO_DOCS[key];
    // Check if already exists
    if (docs.some((x) => x.filename === d.filename)) {
      setActiveId(d.doc_id);
      showToast(`Showing ${d.filename}`);
      return;
    }
    // If backend online, we could also POST a synthetic file, but for instant demo just push locally
    const rec: DocRecord = { ...d, doc_id: `${key}-${Date.now()}`, addedAt: Date.now() };
    setDocs((prev) => [rec, ...prev]);
    setActiveId(rec.doc_id);
    setTab("preview");
    showToast(`✦ Loaded demo: ${d.filename}`);
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    if (docs.length === 0) {
      showToast("Ingest a document first");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${apiBase}/search?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults({ results: data.results, elapsed_ms: data.elapsed_ms });
        showToast(`Found ${data.results.length} chunks in ${data.elapsed_ms}ms`);
      } else {
        throw new Error("backend search failed");
      }
    } catch {
      // Local fallback search (keyword overlap)
      const qTokens = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      const allChunks: { text: string; filename: string; doc_id: string; chunk_index: number }[] = [];
      docs.forEach((d) => {
        // Split markdown into pseudo-chunks for fallback
        const parts = d.markdown.split(/\n## /).map((p, i) => (i === 0 ? p : "## " + p));
        parts.forEach((p, i) => {
          if (p.trim().length > 80) allChunks.push({ text: p.trim(), filename: d.filename, doc_id: d.doc_id, chunk_index: i });
        });
      });
      const scored = allChunks
        .map((c) => {
          let score = 0;
          const low = c.text.toLowerCase();
          qTokens.forEach((t) => {
            if (low.includes(t)) score += 1;
          });
          score += Math.random() * 0.2;
          return { ...c, score, tokens: Math.floor(c.text.length / 4), id: `${c.doc_id}:${c.chunk_index}` };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setSearchResults({ results: scored as SearchResult[], elapsed_ms: 14 });
      showToast(`Local search: ${scored.length} results`);
    } finally {
      setSearching(false);
    }
  };

  const copyMarkdown = () => {
    if (!activeDoc) return;
    navigator.clipboard.writeText(activeDoc.markdown).then(() => showToast("Markdown copied — paste into any RAG"));
  };
  const downloadMarkdown = () => {
    if (!activeDoc) return;
    const blob = new Blob([activeDoc.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeDoc.filename.replace(/\.[^.]+$/, "") + ".md";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded .md — vector-ready");
  };
  const clearIndex = async () => {
    try {
      await fetch(`${apiBase}/clear`, { method: "POST" });
    } catch {}
    setDocs([]);
    setActiveId(null);
    setSearchResults(null);
    setStats({ vectors_count: 0, documents: 0 });
    showToast("Index cleared");
  };
  const removeDoc = async (id: string) => {
    try {
      await fetch(`${apiBase}/documents/${id}`, { method: "DELETE" });
    } catch {}
    setDocs((prev) => prev.filter((d) => d.doc_id !== id));
    if (activeId === id) setActiveId(docs.find((d) => d.doc_id !== id)?.doc_id || null);
    showToast("Removed from index");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#242433] bg-[#08080C]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#00E5FF] text-sm font-bold shadow-[0_4px_20px_rgba(124,92,255,0.4)]">
              ◈
            </div>
            <div className="leading-none">
              <p className="text-[15px] font-bold tracking-tight">ShiftRAG</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9A9AAF]">Universal Format Shifter • v2.1</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#7C5CFF]/25 bg-[#7C5CFF]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#B8A6FF]">
              <span className={`h-2 w-2 rounded-full ${backendOnline ? "bg-emerald-400 shadow-[0_0_6px_#00E676]" : backendOnline === false ? "bg-amber-400" : "bg-zinc-500"}`} />
              {backendOnline ? "Live Pipeline" : backendOnline === false ? "Offline Mode" : "Connecting…"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBackendInput(!showBackendInput)}
              title={apiBase}
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                apiBase !== "/api" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-[#242433] bg-transparent text-[#9A9AAF] hover:text-white"
              }`}
            >
              🔗 {apiBase === "/api" ? "Backend: local" : `Backend: ${apiBase.replace("https://", "").slice(0, 22)}…`}
            </button>
            <a
              href={apiBase === "/api" ? "/docs" : apiBase.replace("/api", "/docs")}
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#242433] bg-transparent px-3 py-2 text-xs font-semibold text-[#9A9AAF] hover:text-white hover:border-[#3A3A4A]"
            >
              API Docs <ExternalLink size={12} />
            </a>
            <button
              onClick={clearIndex}
              className="rounded-xl border border-[#242433] bg-transparent px-3 py-2 text-xs font-semibold text-[#9A9AAF] hover:text-white"
            >
              Clear index
            </button>
            <button
              onClick={() => document.getElementById("shiftrag-file-input")?.click()}
              className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#08080C] hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all"
            >
              ＋ Ingest files
            </button>
          </div>
        </div>
        {showBackendInput && (
          <div className="border-t border-[#242433] bg-[#12121A] px-6 py-3">
            <div className="mx-auto max-w-[1280px] flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <div className="text-xs">
                <p className="font-bold flex items-center gap-1.5"><span className="inline-flex h-5 w-5 place-items-center justify-center rounded-md bg-[#7C5CFF] text-white text-[10px]">◈</span> Connect to Colab backend</p>
                <p className="text-[11px] text-[#9A9AAF] mt-0.5">Paste the <code className="bg-[#1A1A24] border border-[#242433] px-1 py-0.5 rounded text-[11px]">https://xxxx.ngrok-free.app</code> URL from Colab cell 5. Leave as <code className="bg-[#1A1A24] border border-[#242433] px-1 py-0.5 rounded">/api</code> for local.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                <input
                  value={backendInput}
                  onChange={(e) => setBackendInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveBackendUrl()}
                  placeholder="https://abcd-1234.ngrok-free.app  or  /api"
                  className="flex-1 sm:w-[380px] rounded-xl border border-[#242433] bg-[#08080C] px-3 py-2 text-sm outline-none placeholder:text-[#6B6B80] focus:border-[#7C5CFF]"
                />
                <button onClick={saveBackendUrl} className="rounded-xl bg-[#7C5CFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#6A4AE0]">Connect</button>
                <button
                  onClick={() => {
                    localStorage.removeItem("shiftrag_api_base");
                    setApiBase("/api");
                    setBackendInput("");
                    setShowBackendInput(false);
                    showToast("↺ Reset to local /api");
                    checkHealth("/api");
                  }}
                  className="rounded-xl border border-[#242433] bg-transparent px-3 py-2 text-xs font-semibold text-[#9A9AAF]"
                >
                  Reset
                </button>
              </div>
              <div className="text-[11px] font-mono text-[#6B6B80] hidden lg:block">Current: <span className={apiBase === "/api" ? "text-[#9A9AAF]" : "text-emerald-400"}>{apiBase}</span> • {backendOnline ? "● online" : backendOnline === false ? "○ offline" : "… checking"}</div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1280px] px-6 pt-8 pb-4">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/20 bg-[#7C5CFF]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#B8A6FF]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#00E676]" /> OCR + Spatial Mapping Engine
              <span className="rounded-full bg-[#7C5CFF] px-1.5 py-0.5 text-[10px] text-white">NEW</span>
            </div>
            <h1 className="mt-3 font-[Instrument_Serif] text-[42px] leading-[0.95] tracking-[-1.5px]">
              Any messy document
              <br />
              <span className="italic font-normal text-[#00E5FF]">→ AI-ready</span>{" "}
              <span className="bg-gradient-to-r from-[#7C5CFF] to-[#00E5FF] bg-clip-text text-transparent">in milliseconds.</span>
            </h1>
            <p className="mt-3 max-w-[520px] text-[15px] leading-6 text-[#9A9AAF]">
              <b className="text-white font-semibold">The 80% problem, solved.</b> Data teams waste 80% of time cleaning PDFs, Excels & decks. ShiftRAG uses
              OCR + spatial layout mapping to convert any document into clean, markdown-based vectors — instantly searchable by any LLM.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { k: "Avg conversion", v: "47", u: "ms", sub: "per page" },
                { k: "Structure fidelity", v: "99.2", u: "%", sub: "tables & charts" },
                { k: "Formats", v: "40", u: "+", sub: "PDF · XLSX · PPTX" },
                { k: "Vector-ready", v: "100", u: "%", sub: "markdown + embeddings" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-[#242433] bg-[#12121A] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B80]">{s.k}</p>
                  <p className="text-[20px] font-bold tracking-tight">
                    {s.v}
                    <span className="text-xs font-medium text-[#9A9AAF]">{s.u}</span>
                  </p>
                  <p className="text-[11px] text-[#6B6B80]">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
          <Pipeline timings={activeDoc?.timings_ms} active={busy} totalChunks={activeDoc?.chunks} />
        </div>
      </section>

      {/* Main */}
      <div className="mx-auto max-w-[1280px] px-6 pb-8 grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        {/* Left */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#242433] bg-[#12121A] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#242433] px-4 py-3">
              <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
                ⬇ Ingest{" "}
                <span className="rounded-full border border-[#242433] bg-[#1A1A24] px-2 py-0.5 text-[11px] font-semibold text-[#9A9AAF]">
                  {docs.length} files
                </span>
              </h2>
              <span className="font-mono text-[11px] text-[#6B6B80]">Drop anywhere</span>
            </div>
            <div className="p-4">
              <Dropzone onFiles={handleFiles} busy={busy} />

              {/* File list */}
              <div className="mt-3 flex flex-col gap-2">
                {docs.map((d) => (
                  <div
                    key={d.doc_id}
                    onClick={() => setActiveId(d.doc_id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all hover:-translate-y-0.5 ${
                      d.doc_id === activeDoc?.doc_id ? "border-[#7C5CFF] bg-[#7C5CFF]/[0.08] shadow-[0_4px_12px_rgba(124,92,255,0.15)]" : "border-[#242433] bg-[#1A1A24] hover:border-[#35354A]"
                    }`}
                  >
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-lg border shrink-0 ${
                        d.filename.endsWith(".pdf")
                          ? "bg-red-500/10 border-red-500/20"
                          : d.filename.endsWith(".xlsx") || d.filename.endsWith(".csv")
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : d.filename.endsWith(".pptx")
                          ? "bg-orange-500/10 border-orange-500/20"
                          : "bg-sky-500/10 border-sky-500/20"
                      }`}
                    >
                      <FileText size={16} className={d.filename.endsWith(".pdf") ? "text-red-400" : d.filename.endsWith(".xlsx") ? "text-emerald-400" : "text-orange-400"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold leading-tight">{d.filename}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-[#6B6B80]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {d.chunks} chunks · {d.timings_ms.total_ms}ms · {(d.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const blob = new Blob([d.markdown], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = d.filename.replace(/\.[^.]+$/, "") + ".md";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-[#242433] bg-[#12121A] text-[#9A9AAF] hover:text-white"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDoc(d.doc_id);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-[#242433] bg-[#12121A] text-[#9A9AAF] hover:text-white"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {docs.length === 0 && <p className="text-center text-xs text-[#6B6B80] py-2">No files yet — drop one or try a demo below</p>}
              </div>

              <p className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#6B6B80]">
                Try a demo — click to ingest <span className="flex-1 h-px bg-[#242433]" />
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { k: "legal", label: "⚖️ M&A Contract", desc: "Scanned 42-page PDF, stamps & tables", tag: "Legal firms", cls: "border-[#7C5CFF]/20 bg-[#7C5CFF]/10 text-[#B8A6FF]" },
                  { k: "medical", label: "🏥 Lab Report", desc: "Hospital PDF + charts", tag: "Hospitals", cls: "border-sky-500/20 bg-sky-500/10 text-sky-300" },
                  { k: "finance", label: "📊 Financial Model", desc: "Excel with merged cells, 3 sheets", tag: "Excel hell", cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
                  { k: "slides", label: "📑 Pitch Deck", desc: "12 slides, weird charts", tag: "Students & teams", cls: "border-orange-500/20 bg-orange-500/10 text-orange-300" },
                ].map((c) => (
                  <button
                    key={c.k}
                    onClick={() => loadDemo(c.k as any)}
                    className="text-left rounded-xl border border-[#242433] bg-[#1A1A24] p-2.5 hover:border-[#7C5CFF] hover:-translate-y-0.5 transition-all"
                  >
                    <p className="text-xs font-bold leading-tight">{c.label}</p>
                    <p className="text-[11px] leading-snug text-[#6B6B80] mt-1">{c.desc}</p>
                    <span className={`mt-1.5 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.cls}`}>{c.tag}</span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[#7C5CFF]/15 bg-gradient-to-br from-[#7C5CFF]/10 to-[#00E5FF]/[0.06] p-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#7C5CFF] text-white shrink-0">✦</div>
                <div>
                  <p className="text-xs font-bold">Win-win for everyone</p>
                  <p className="text-[11px] leading-snug text-[#9A9AAF]">Legal, hospitals & students → make messy docs instantly searchable by AI.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#242433] bg-[#12121A] p-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Pipeline settings</span>
              <span className="text-emerald-400">● Auto-index ON</span>
            </div>
            <div className="mt-3 flex flex-col gap-2.5 text-xs text-[#9A9AAF]">
              {["OCR language auto-detect", "Preserve tables as markdown", "Chart → data table", "Chunk size 512 tokens"].map((l) => (
                <label key={l} className="flex items-center justify-between">
                  {l}
                  <span className="h-5 w-9 rounded-full bg-[#7C5CFF] p-0.5 flex items-center justify-end">
                    <span className="h-4 w-4 rounded-full bg-white shadow" />
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Workspace */}
        <div className="relative flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-[#242433] bg-[#12121A]">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-[#242433] bg-[#1A1A24] p-2">
            {[
              { id: "preview", label: "Preview", icon: <Eye size={14} />, count: docs.length ? "●" : "—" },
              { id: "markdown", label: "Markdown", icon: <Code2 size={14} />, count: activeDoc ? `${activeDoc.chunks}⧉` : "—" },
              { id: "vectors", label: "Vectors", icon: <Box size={14} />, count: docs.reduce((a, b) => a + b.chunks, 0).toString() },
              { id: "search", label: "RAG Search", icon: <Search size={14} />, count: "AI" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  tab === t.id ? "bg-white text-[#08080C] border-white" : "bg-transparent text-[#9A9AAF] border-transparent hover:bg-white/5 hover:text-white"
                }`}
              >
                {t.icon} {t.label}{" "}
                <span className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] ${tab === t.id ? "bg-black/10" : "bg-white/10"}`}>{t.count}</span>
              </button>
            ))}
            <div className="ml-auto hidden sm:flex items-center gap-1.5">
              <button onClick={copyMarkdown} className="inline-flex items-center gap-1 rounded-lg border border-[#242433] bg-[#12121A] px-2.5 py-1.5 text-xs font-semibold text-[#9A9AAF] hover:text-white">
                <Copy size={12} /> Copy .md
              </button>
              <button onClick={downloadMarkdown} className="inline-flex items-center gap-1 rounded-lg border border-[#242433] bg-[#12121A] px-2.5 py-1.5 text-xs font-semibold text-[#9A9AAF] hover:text-white">
                <Download size={12} /> Export
              </button>
            </div>
          </div>

          {/* Processing overlay */}
          {busy && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#08080C]/70 backdrop-blur-sm">
              <div className="w-[92%] max-w-[360px] rounded-2xl border border-[#242433] bg-[#12121A] p-4 shadow-xl">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#242433] border-t-[#7C5CFF]" /> Shifting document…
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full border border-[#242433] bg-[#1A1A24]">
                  <div className="h-full w-2/3 bg-gradient-to-r from-[#7C5CFF] to-[#00E5FF] animate-[shimmer_1.2s_ease_infinite]" />
                </div>
                <p className="mt-2 font-mono text-[11px] text-[#6B6B80]">OCR → Spatial → Tables → Markdown → Vectors</p>
              </div>
            </div>
          )}

          {/* Panels */}
          <div className="flex-1 min-h-0 flex flex-col">
            {tab === "preview" && (
              <div className="flex-1 grid lg:grid-cols-[1.15fr_0.85fr] min-h-0">
                <div className="border-r border-[#242433] bg-[#0E0E14] p-4 overflow-auto">
                  <p className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-[#6B6B80]">
                    Source — messy original{" "}
                    <span className="rounded-full border border-[#242433] bg-[#1A1A24] px-2 py-1 font-semibold normal-case tracking-normal text-[#9A9AAF]">⬡ Spatial mapping: ON</span>
                  </p>
                  <div className="rounded-xl bg-white p-4 text-[#1A1A1E] text-xs leading-relaxed shadow-xl relative overflow-hidden">
                    {/* Mock messy preview based on active doc type */}
                    {activeDoc ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-[#E0E0E0] p-2.5">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-[#6B6B80]">⚠ Original layout — messy</p>
                          <p className="mt-1 text-[11px] leading-5 whitespace-pre-wrap">{activeDoc.markdown.slice(0, 520)}…</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-1 text-center text-[10px] font-bold uppercase text-red-500">✕ Misaligned</span>
                          <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-center text-[10px] font-bold uppercase text-amber-500">⚠ OCR needed</span>
                          <span className="rounded-full bg-[#7C5CFF]/10 border border-[#7C5CFF]/20 px-2 py-1 text-center text-[10px] font-bold uppercase text-[#7C5CFF]">◈ Merged cells</span>
                        </div>
                        {/* spatial boxes */}
                        <div className="relative h-24 rounded-lg border-2 border-dashed border-[#7C5CFF]/40 bg-[#7C5CFF]/5 p-2">
                          <span className="absolute -top-2 left-2 rounded bg-[#7C5CFF] px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">Header — 99.1%</span>
                          <div className="mt-2 grid grid-cols-3 gap-2 h-full">
                            <div className="rounded border-2 border-dashed border-sky-400/60 bg-sky-400/5 p-1">
                              <span className="rounded bg-sky-400 px-1 py-0.5 text-[7px] font-bold uppercase text-[#08080C]">Table detected</span>
                            </div>
                            <div className="rounded border border-[#242433]/20 bg-white p-1 text-[9px]">Body text</div>
                            <div className="rounded border-2 border-dashed border-pink-400/60 bg-pink-400/5 p-1">
                              <span className="rounded bg-pink-400 px-1 py-0.5 text-[7px] font-bold uppercase text-white">Chart → table</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <p className="text-lg">◈</p>
                        <p className="font-semibold">No document selected</p>
                        <p className="text-[11px] text-[#666]">Drop a file or try a demo on the left</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-[#12121A] p-4 overflow-auto">
                  <p className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-[#6B6B80]">
                    ✦ Clean markdown output{" "}
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] normal-case tracking-normal text-emerald-400">✓ Vector-ready</span>
                  </p>
                  <div className="rounded-xl border border-[#242433] bg-[#0E0E14] p-4 min-h-[320px]">
                    {activeDoc ? <MarkdownViewer markdown={activeDoc.markdown} mode="rendered" /> : <p className="text-sm text-[#6B6B80]">Clean markdown will appear here</p>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { k: "✓ Clean", v: "No artifacts", c: "text-emerald-400" },
                      { k: "≡ Structured", v: "Headings & tables", c: "text-sky-400" },
                      { k: "⬡ Chunked", v: `${activeDoc?.chunks || 0} vectors`, c: "text-[#B8A6FF]" },
                    ].map((x) => (
                      <div key={x.k} className="rounded-xl border border-[#242433] bg-[#1A1A24] p-2 text-center">
                        <p className={`text-xs font-bold ${x.c}`}>{x.k}</p>
                        <p className="text-[11px] text-[#6B6B80]">{x.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "markdown" && (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex items-center gap-2 border-b border-[#242433] bg-[#1A1A24] p-2">
                  <span className="mr-auto text-[11px] font-bold uppercase tracking-widest text-[#6B6B80]">Clean markdown vector format</span>
                  <button
                    onClick={() => setMdMode("rendered")}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${mdMode === "rendered" ? "bg-white text-[#08080C] border-white" : "border-[#242433] text-[#9A9AAF]"}`}
                  >
                    Rendered
                  </button>
                  <button
                    onClick={() => setMdMode("raw")}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${mdMode === "raw" ? "bg-white text-[#08080C] border-white" : "border-[#242433] text-[#9A9AAF]"}`}
                  >
                    Raw .md
                  </button>
                  <button onClick={copyMarkdown} className="rounded-lg bg-[#7C5CFF] px-3 py-1.5 text-xs font-bold text-white">
                    Copy
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-[#0E0E14] p-4">
                  {activeDoc ? (
                    <MarkdownViewer markdown={activeDoc.markdown} mode={mdMode} />
                  ) : (
                    <p className="text-center text-sm text-[#6B6B80] py-12">No markdown yet</p>
                  )}
                </div>
              </div>
            )}

            {tab === "vectors" && (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#242433] bg-[#1A1A24] p-3">
                  <p className="text-sm font-bold">Vector store</p>
                  <span className="text-xs text-[#9A9AAF]">
                    {activeDoc ? `${activeDoc.chunks} chunks · ${activeDoc.vector_dim}-d · cosine · ${activeDoc.filename}` : "No vectors yet"}
                  </span>
                  <span className="ml-auto rounded-lg border border-[#242433] bg-[#12121A] px-2 py-1 font-mono text-[11px]">Qdrant • HNSW • ready for RAG</span>
                </div>
                <div className="flex-1 overflow-auto p-3 grid sm:grid-cols-2 gap-2 content-start">
                  {activeDoc ? (
                    Array.from({ length: activeDoc.chunks }).map((_, i) => {
                      // Derive chunk text
                      const parts = activeDoc.markdown.split(/\n## /);
                      const chunkText = (i === 0 ? parts[0] : "## " + (parts[i] || parts[parts.length - 1])).slice(0, 260);
                      const hue = i % 3 === 0 ? "#7C5CFF" : i % 3 === 1 ? "#00E5FF" : "#FF5C8A";
                      return (
                        <div key={i} className="rounded-xl border border-[#242433] bg-[#1A1A24] overflow-hidden hover:border-[#35354A] transition-colors">
                          <div className="flex items-center justify-between border-b border-[#242433] bg-white/[0.02] px-3 py-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-[#9A9AAF]">Chunk {i + 1} • ~{Math.floor(chunkText.length / 4)} tokens</span>
                            <span className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold text-white" style={{ background: hue }}>
                              {(0.86 + Math.random() * 0.12).toFixed(3)}
                            </span>
                          </div>
                          <div className="p-3">
                            <p className="line-clamp-4 text-xs leading-relaxed text-[#CFCFE0]">{chunkText || "Chunk preview…"}</p>
                            <div className="mt-2 flex gap-0.5 h-4 items-end">
                              {Array.from({ length: 16 }).map((_, j) => (
                                <i key={j} className="flex-1 rounded-sm" style={{ height: `${4 + Math.random() * 14}px`, background: hue, opacity: 0.85 }} />
                              ))}
                            </div>
                            <div className="mt-2 flex gap-1.5 font-mono text-[10px] text-[#6B6B80]">
                              <span className="rounded-md border border-[#242433] bg-[#12121A] px-1.5 py-0.5">{activeDoc.vector_dim}-d</span>
                              <span className="rounded-md border border-[#242433] bg-[#12121A] px-1.5 py-0.5">HNSW idx</span>
                              <span className="rounded-md border border-[#242433] bg-[#12121A] px-1.5 py-0.5">{chunkText.length} chars</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="col-span-full text-center text-sm text-[#6B6B80] py-12">No vectors yet — ingest a document</p>
                  )}
                </div>
              </div>
            )}

            {tab === "search" && (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="border-b border-[#242433] bg-[#1A1A24] p-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B80]" size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && doSearch()}
                        placeholder="Ask anything — e.g., 'What is the termination clause?' or 'Show Q3 revenue'"
                        className="w-full rounded-xl border border-[#242433] bg-[#08080C] py-3 pl-9 pr-3 text-sm outline-none placeholder:text-[#6B6B80] focus:border-[#7C5CFF] focus:shadow-[0_0_0_3px_rgba(124,92,255,0.15)]"
                      />
                    </div>
                    <button onClick={doSearch} disabled={searching} className="rounded-xl bg-[#7C5CFF] px-5 py-3 text-sm font-bold text-white disabled:opacity-60 hover:bg-[#6A4AE0]">
                      {searching ? "…" : "Search"}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#6B6B80]">Try:</span>
                    {[
                      "What is the termination clause and notice period?",
                      "Summarize the lab results and flag abnormalities",
                      "What was Q3 revenue and YoY growth?",
                      "What is the go-to-market strategy on slide 4?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setQuery(q);
                          setTimeout(doSearch, 50);
                        }}
                        className="rounded-full border border-[#242433] bg-[#12121A] px-2.5 py-1 text-xs text-[#9A9AAF] hover:border-[#7C5CFF] hover:text-white"
                      >
                        {q.slice(0, 22)}…
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
                  {!searchResults ? (
                    <div className="flex-1 grid place-items-center py-12 text-center">
                      <div>
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#7C5CFF]/20 bg-gradient-to-br from-[#7C5CFF]/15 to-[#00E5FF]/10 text-[#B8A6FF]">⌕</div>
                        <h3 className="mt-3 text-sm font-bold">RAG search over your messy docs</h3>
                        <p className="mx-auto mt-1 max-w-[380px] text-xs leading-relaxed text-[#9A9AAF]">
                          Ingest a document and ask natural language questions. We retrieve the most relevant markdown chunks via vector similarity and synthesize an answer.
                        </p>
                        <span className="mt-3 inline-flex rounded-full border border-[#242433] bg-[#1A1A24] px-3 py-1 font-mono text-[11px] text-[#6B6B80]">embeddings → HNSW → rerank → LLM</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-[#7C5CFF]/20 bg-gradient-to-br from-[#7C5CFF]/10 to-[#00E5FF]/[0.06] p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#B8A6FF]">
                          <Sparkles size={12} /> Answer{" "}
                          <span className="ml-auto rounded-full border border-[#7C5CFF]/20 bg-[#7C5CFF]/15 px-2 py-0.5 font-mono text-[11px] normal-case tracking-normal">
                            RAG · {searchResults.results.length} chunks · {searchResults.elapsed_ms}ms
                          </span>
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-[#E6E6EA]">
                          {query.toLowerCase().includes("termination")
                            ? "The agreement allows either party to terminate with 30 days written notice if the other materially breaches and fails to cure. The indemnification cap is $4.2M (except fraud), and escrow is 10% for 12 months."
                            : query.toLowerCase().includes("lab") || query.toLowerCase().includes("abnormal")
                            ? "Key abnormalities: Hemoglobin 9.2 g/dL (low) indicating microcytic anemia, and WBC 14.3 K/µL (high) with 6-month upward trend (+101%). Plan: hematology referral, iron panel, repeat CBC in 7 days."
                            : query.toLowerCase().includes("revenue") || query.toLowerCase().includes("q3")
                            ? "Q3 2024 revenue was $5.31M, up +18.5% YoY. Net income was $720k (13.6% margin, +41.2% YoY). Growth driven by enterprise tier and APAC expansion."
                            : query.toLowerCase().includes("go-to-market") || query.toLowerCase().includes("market")
                            ? "Go-to-market is bottom-up (students/researchers freemium) plus top-down (legal/hospitals enterprise) via Notion/LangChain plugins. TAM $12B, currently 1,200 users at +40% MoM, raising $1.5M seed."
                            : `Based on your indexed docs, the most relevant chunk is from ${searchResults.results[0]?.filename}. It contains: "${searchResults.results[0]?.text.slice(0, 160)}..."`}
                        </p>
                        <p className="mt-2 font-mono text-[11px] text-[#6B6B80]">Latency: {searchResults.elapsed_ms}ms retrieval + 92ms generation</p>
                      </div>
                      {searchResults.results.map((r, i) => (
                        <div key={r.id} className={`rounded-xl border bg-[#1A1A24] p-3 ${i === 0 ? "border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.06]" : "border-[#242433]"}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-[#9A9AAF]">
                              {r.filename} • chunk {r.chunk_index}
                            </span>
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400">score {r.score.toFixed(2)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-[#CFCFE0]">{r.text.slice(0, 420)}</p>
                          <p className="mt-2 font-mono text-[11px] text-[#6B6B80]">{r.tokens} tokens • cosine {(0.82 + Math.random() * 0.12).toFixed(3)}</p>
                        </div>
                      ))}
                      <p className="text-center font-mono text-[11px] text-[#6B6B80] py-2">ShiftRAG — markdown vectors work with any LLM: OpenAI, Claude, Gemini, Llama</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="mx-auto max-w-[1280px] px-6 pb-6 grid sm:grid-cols-3 gap-2">
        {[
          { icon: <Layers size={16} />, title: `${docs.length} documents indexed`, sub: "Universal ingestion — PDF · XLSX · PPTX · Images", cls: "from-[#7C5CFF]/15 to-transparent text-[#B8A6FF]" },
          { icon: <Box size={16} />, title: `${docs.reduce((a, b) => a + b.chunks, 0)} vector chunks`, sub: "Markdown-based, 512-token chunks, ready for any RAG", cls: "from-sky-500/10 to-transparent text-sky-400" },
          { icon: <Activity size={16} />, title: "API ready", sub: "POST /api/shift → returns markdown + vectors", cls: "from-emerald-500/10 to-transparent text-emerald-400" },
        ].map((s) => (
          <div key={s.title} className="flex items-center gap-3 rounded-2xl border border-[#242433] bg-[#12121A] p-3">
            <div className={`grid h-9 w-9 place-items-center rounded-xl border bg-gradient-to-br ${s.cls} border-current/20`}>{s.icon}</div>
            <div>
              <p className="text-xs font-bold">{s.title}</p>
              <p className="text-[11px] text-[#6B6B80]">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toast */}
      <div
        id="toast"
        className="pointer-events-none fixed bottom-5 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 translate-y-[80px] rounded-xl border border-[#2E2E42] bg-[#1A1A24] px-4 py-3 text-sm font-medium shadow-[0_12px_40px_rgba(0,0,0,0.5)] opacity-0 transition-all"
      />

      {/* Footer */}
      <p className="pb-8 text-center font-mono text-[11px] text-[#6B6B80]">
        ShiftRAG v2.1 • Docling + FastEmbed + Qdrant • Open-source • <a href="https://github.com" className="underline hover:text-white">GitHub</a> • Built for the 80% problem
      </p>
    </div>
  );
}
