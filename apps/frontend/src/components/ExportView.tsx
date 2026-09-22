"use client";

import React, { useState } from "react";
import { Printer, Download, Copy, Check, FileJson } from "lucide-react";
import { Kit, sanitizeKitForAppendixA } from "@prepkit/core";

interface ExportViewProps {
  kit: Kit;
}

export const ExportView: React.FC<ExportViewProps> = ({ kit }) => {
  const [copied, setCopied] = useState(false);

  const cleanKit = sanitizeKitForAppendixA(kit);
  const jsonString = JSON.stringify(cleanKit, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-prep-kit-${kit.source.company.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Action Bar */}
      <div className="no-print glass-panel rounded-2xl p-5 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Export & Printable One-Pager</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Print a condensed cheat-sheet for offline prep or export exact Appendix A JSON.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Print Cheat-Sheet</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{copied ? "Copied!" : "Copy JSON"}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Appendix A JSON</span>
          </button>
        </div>
      </div>

      {/* Printable Cheat-Sheet View */}
      <div className="glass-panel rounded-2xl p-8 border border-slate-800 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
              Interview Cheat-Sheet
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {new Date(kit.source.researched_at).toLocaleDateString()}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">
            {kit.role.title} @ {kit.source.company}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{kit.company_brief.summary}</p>
        </div>

        {/* Priority Requirements */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
            Priority Must-Have Requirements
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {kit.role.requirements
              .filter((r) => r.priority === "must")
              .map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="font-mono font-bold text-indigo-400 mr-1.5">{r.id}:</span>
                  <span className="text-slate-200">{r.text}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Essential Questions & Benchmark Strategies */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
            Key Questions & Benchmark Answers
          </h4>
          <div className="space-y-3">
            {kit.questions.slice(0, 6).map((q) => (
              <div key={q.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-indigo-300 capitalize">{q.category}</span>
                  <span className="text-slate-500 font-mono">Diff: {q.difficulty}/3</span>
                </div>
                <p className="text-xs font-bold text-white">{q.prompt}</p>
                <p className="text-xs text-slate-300 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                  {q.answer_outline}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Raw Appendix A JSON Viewer */}
      <div className="no-print glass-panel rounded-2xl p-6 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-bold text-white tracking-tight">Appendix A Conforming JSON</h4>
        </div>
        <pre className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-96 leading-relaxed">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
