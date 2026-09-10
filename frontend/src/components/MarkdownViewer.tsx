"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownViewer({
  markdown,
  mode,
}: {
  markdown: string;
  mode: "rendered" | "raw";
}) {
  if (!markdown) {
    return (
      <div className="grid place-items-center py-16 text-center text-sm text-[#6B6B80]">
        <p>No markdown yet — ingest a document to see output.</p>
      </div>
    );
  }

  if (mode === "raw") {
    return (
      <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-7 text-[#D8D8E0]">
        {markdown}
      </pre>
    );
  }

  return (
    <div className="prose max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
