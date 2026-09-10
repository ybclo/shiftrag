import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftRAG — Universal Format Shifter for RAG",
  description:
    "Enterprise-grade ingestion pipeline: messy PDFs, XLSX, PPTX → clean markdown vectors in milliseconds. OCR + spatial mapping → Qdrant.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#08080C] text-[#F1F1F3] antialiased overflow-x-hidden">
        {/* Background grid & glows */}
        <div className="pointer-events-none fixed inset-0 opacity-[0.35] bg-[linear-gradient(rgba(124,92,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(124,92,255,0.07)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_0%,black_60%,transparent_85%)]" />
        <div className="pointer-events-none fixed -top-[100px] left-[20%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.22),transparent_70%)] blur-[1px]" />
        <div className="pointer-events-none fixed top-[200px] right-[5%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.12),transparent_70%)] blur-[1px]" />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
