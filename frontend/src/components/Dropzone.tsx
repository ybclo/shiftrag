"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, Table2, Presentation, Image as ImageIcon, X } from "lucide-react";

type DropzoneProps = {
  onFiles: (files: FileList) => void;
  busy?: boolean;
};

const FORMATS = [
  { label: ".PDF", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  { label: ".XLSX", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { label: ".PPTX", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { label: ".DOCX", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
];

export default function Dropzone({ onFiles, busy }: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`group relative cursor-pointer rounded-2xl border-[1.5px] border-dashed p-6 text-center transition-all ${
        dragOver
          ? "border-[#00E5FF] bg-[#00E5FF]/[0.07] scale-[1.01]"
          : "border-[#3A3A4A] bg-[#12121A]/60 hover:border-[#7C5CFF] hover:bg-[#7C5CFF]/[0.06]"
      }`}
      onClick={() => document.getElementById("shiftrag-file-input")?.click()}
    >
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-[#7C5CFF]/20 bg-gradient-to-br from-[#7C5CFF]/15 to-[#00E5FF]/10 text-[#B8A6FF]">
        <Upload size={20} />
      </div>
      <p className="text-[13px] font-semibold tracking-tight">Drop messy files here</p>
      <p className="mx-auto mt-1 max-w-[280px] text-xs leading-relaxed text-[#9A9AAF]">
        PDFs, Excels with merged cells, scanned images, slide decks with charts — we handle it
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {FORMATS.map((f) => (
          <span
            key={f.label}
            className={`rounded-md border px-2 py-1 font-mono text-[10px] font-bold tracking-wide ${f.cls}`}
          >
            {f.label}
          </span>
        ))}
        <span className="rounded-md border border-[#242433] bg-[#1A1A24] px-2 py-1 font-mono text-[10px] font-bold text-[#9A9AAF]">
          .PNG .JPG .CSV
        </span>
      </div>

      {busy && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-[#08080C]/70 backdrop-blur-sm">
          <span className="rounded-full bg-[#1A1A24] px-3 py-1.5 text-xs font-semibold border border-[#242433]">
            Processing…
          </span>
        </div>
      )}

      <input
        id="shiftrag-file-input"
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.xlsx,.xls,.pptx,.ppt,.docx,.doc,.csv,.txt,.png,.jpg,.jpeg,.webp"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
    </div>
  );
}

// Helper to pick icon per type
export function FileTypeIcon({ ext, size = 16 }: { ext: string; size?: number }) {
  const e = ext.toLowerCase();
  if ([".xlsx", ".xls", ".csv"].includes(e)) return <Table2 size={size} className="text-emerald-400" />;
  if ([".pptx", ".ppt"].includes(e)) return <Presentation size={size} className="text-orange-400" />;
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(e)) return <ImageIcon size={size} className="text-sky-400" />;
  return <FileText size={size} className="text-red-400" />;
}
