"use client";

import { ScanEye, Grid3X3, Table2, FileText, Database, Check } from "lucide-react";

export type PipelineTimings = {
  ocr_ms?: number;
  spatial_ms?: number;
  table_ms?: number;
  markdown_ms?: number;
  chunking_ms?: number;
  embedding_ms?: number;
  indexing_ms?: number;
  total_ms?: number;
};

type Step = {
  key: keyof PipelineTimings;
  label: string;
  sub: string;
  icon: React.ReactNode;
};

const STEPS: Step[] = [
  { key: "ocr_ms", label: "OCR + Vision", sub: "Text + handwriting", icon: <ScanEye size={14} /> },
  { key: "spatial_ms", label: "Spatial Mapping", sub: "Bbox, columns, reading order", icon: <Grid3X3 size={14} /> },
  { key: "table_ms", label: "Table & Chart Recovery", sub: "Merged cells, legends, axes", icon: <Table2 size={14} /> },
  { key: "markdown_ms", label: "Markdown Structuring", sub: "Headings, lists, tables → .md", icon: <FileText size={14} /> },
  { key: "embedding_ms", label: "Vector Embedding", sub: "Chunk + 384-d embeddings", icon: <Database size={14} /> },
];

export default function Pipeline({
  timings,
  active,
  totalChunks,
}: {
  timings?: PipelineTimings;
  active?: boolean; // true when processing
  totalChunks?: number;
}) {
  const total = timings?.total_ms ?? 47;
  const hasTimings = !!timings;

  return (
    <div className="rounded-2xl border border-[#242433] bg-[#12121A] p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#7C5CFF]/[0.06] to-transparent" />
      <div className="relative">
        <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A9AAF]">
          <span className="h-2 w-2 animate-[pulse-dot_2s_infinite] rounded-full bg-emerald-400 shadow-[0_0_8px_#00E676]" />
          Live ingestion pipeline
        </h3>

        <div className="flex flex-col gap-2">
          {STEPS.map((s, i) => {
            const ms = timings?.[s.key];
            const done = hasTimings && ms !== undefined;
            const isActive = active && i === 0; // simple: first step pulses when active
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 rounded-xl border px-3 py-[9px] transition-all ${
                  isActive
                    ? "border-[#7C5CFF]/40 bg-[#7C5CFF]/10"
                    : done
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-transparent bg-[#1A1A24]"
                }`}
              >
                <div
                  className={`grid h-8 w-8 place-items-center rounded-lg border text-xs shrink-0 ${
                    isActive
                      ? "bg-[#7C5CFF] text-white border-[#7C5CFF] shadow-[0_4px_12px_rgba(124,92,255,0.4)]"
                      : done
                      ? "bg-emerald-500 text-[#08080C] border-emerald-500"
                      : "bg-[#242433] text-[#9A9AAF] border-[#2E2E42]"
                  }`}
                >
                  {done ? <Check size={14} /> : s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-none tracking-tight">{s.label}</p>
                  <p className="text-[11px] text-[#6B6B80]">{s.sub}</p>
                </div>
                <span
                  className={`shrink-0 rounded-md border px-1.5 py-1 font-mono text-[11px] ${
                    done ? "border-emerald-500/20 bg-[#08080C] text-emerald-400" : "border-[#242433] bg-[#08080C] text-[#9A9AAF]"
                  }`}
                >
                  {ms !== undefined ? `${ms}ms` : hasTimings ? "—" : i === 0 ? "12ms" : i === 1 ? "9ms" : i === 2 ? "14ms" : i === 3 ? "5ms" : "7ms"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#6B6B80]">
          <span>
            Total: <b className="text-emerald-400">{total}ms</b> {totalChunks ? `· ${totalChunks} chunks` : "· 3 pages · 18 chunks"}
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Indexed in Qdrant
          </span>
        </div>
      </div>
    </div>
  );
}
