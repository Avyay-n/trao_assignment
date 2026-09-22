"use client";

import React, { useState } from "react";
import { X, Sparkles, Upload, Clock, Globe, FileText, CheckCircle2, AlertCircle, Loader2, FolderUp } from "lucide-react";
import { fetchApi, API_BASE } from "@/lib/api";

interface NewKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKitCreated: (kitId: string) => void;
}

export const NewKitModal: React.FC<NewKitModalProps> = ({ isOpen, onClose, onKitCreated }) => {
  const [tab, setTab] = useState<"single" | "batch">("single");
  const [companyUrl, setCompanyUrl] = useState("https://stripe.com");
  const [jd, setJd] = useState(
    `Senior Full-Stack Engineer\n\nWe are looking for an experienced software engineer to build scalable web platforms.\n\nRequirements:\n- 5+ years building full-stack applications with TypeScript, React, and Node.js\n- Demonstrated experience architecting distributed databases and resilient APIs\n- Strong background with containerization, CI/CD, and cloud observability\n- Bonus: Experience with asynchronous event streaming (Kafka/RabbitMQ)\n- Proven mentorship skills guiding engineers and leading technical reviews`
  );
  const [days, setDays] = useState(5);
  const [batchJson, setBatchJson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBatchJson(content);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const handlePreset = (preset: "standard" | "thin" | "one_day") => {
    if (preset === "standard") {
      setCompanyUrl("https://posthog.com");
      setDays(5);
      setJd(
        `Staff Backend Engineer\n\nScale our event processing pipeline ingesting billions of events daily.\n- 7+ years backend engineering in Python, Go, or Node.js\n- Deep expertise in ClickHouse, PostgreSQL, or Kafka\n- Strong track record in system architecture and high-availability operations\n- Must: Mentorship and technical RFC leadership\n- Plus: Experience with open-source project management`
      );
    } else if (preset === "thin") {
      setCompanyUrl("https://example.com/company");
      setDays(3);
      setJd("Junior Web Developer\nBuild web pages using HTML, CSS, and basic JavaScript. 1 year experience required.");
    } else if (preset === "one_day") {
      setCompanyUrl("https://gitlab.com");
      setDays(1);
      setJd(
        `Senior Security Engineer\n\nLead cloud security audits and vulnerability remediation.\n- 5+ years cloud application security\n- Hands-on threat modeling, penetration testing, and zero-trust policies\n- Must: Incident response coordination under pressure`
      );
    }
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setProgressMsg("Starting research crawler and LLM pipeline...");
    setProgressPct(10);

    try {
      const data = await fetchApi<{ kit: { _id: string } }>("/kits", {
        method: "POST",
        body: JSON.stringify({ company_url: companyUrl, jd, days }),
      });

      const kitId = data.kit._id;

      // Listen for SSE progress
      const eventSource = new EventSource(`${API_BASE}/kits/${kitId}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setProgressMsg(payload.message);
          setProgressPct(payload.progress);

          if (payload.phase === "completed" || payload.progress >= 100) {
            eventSource.close();
            setIsSubmitting(false);
            onKitCreated(kitId);
          } else if (payload.phase === "failed") {
            eventSource.close();
            setIsSubmitting(false);
            setError(payload.message || "Generation failed.");
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        // SSE disconnected or complete, poll status
        eventSource.close();
        setTimeout(() => {
          setIsSubmitting(false);
          onKitCreated(kitId);
        }, 3000);
      };
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || "Failed to create prep kit.");
    }
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setProgressMsg("Processing batch cases...");
    setProgressPct(20);

    try {
      const parsedCases = JSON.parse(batchJson);
      await fetchApi("/kits/batch", {
        method: "POST",
        body: JSON.stringify({ cases: parsedCases }),
      });
      setIsSubmitting(false);
      onClose();
      window.location.reload();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || "Invalid JSON format for batch cases.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-700/80 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Create Interview Preparation Kit</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex gap-2 mt-4 p-1 bg-slate-900/60 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setTab("single")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === "single" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Single Job Description
          </button>
          <button
            type="button"
            onClick={() => setTab("batch")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === "batch" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Batch File Upload
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isSubmitting ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <Sparkles className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Generating Preparation Kit</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">{progressMsg}</p>
            </div>
            <div className="w-full max-w-md bg-slate-800 rounded-full h-2 overflow-hidden mt-2">
              <div
                className="bg-indigo-500 h-2 transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-indigo-400">{progressPct}% completed</span>
          </div>
        ) : tab === "single" ? (
          <form onSubmit={handleSubmitSingle} className="mt-5 space-y-4">
            {/* Quick Presets */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-[11px] text-slate-500 font-medium">Quick Presets:</span>
              <button
                type="button"
                onClick={() => handlePreset("standard")}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px]"
              >
                Staff Eng (5d)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("thin")}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px]"
              >
                Thin JD (3d)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("one_day")}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px]"
              >
                1-Day Cram
              </button>
            </div>

            {/* Company URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Company Website Address</span>
              </label>
              <input
                type="text"
                required
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://company.com or http://localhost:8099/acme/"
                className="w-full px-3.5 py-2 rounded-xl glass-input text-sm focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Days Available */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Days Before Interview</span>
                </label>
                <span className="text-xs font-mono font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20">
                  {days} {days === 1 ? "day" : "days"}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pasted Job Description</span>
              </label>
              <textarea
                required
                rows={6}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job description text here..."
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono leading-relaxed"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Prep Kit</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitBatch} className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload a JSON file or paste cases below to prepare for multiple roles simultaneously:
              </p>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium border border-slate-700/80 transition-colors shadow-sm">
                <FolderUp className="w-3.5 h-3.5" />
                <span>Upload .json File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              required
              rows={8}
              value={batchJson}
              onChange={(e) => setBatchJson(e.target.value)}
              placeholder={`[\n  {\n    "id": "case-01",\n    "company_url": "https://stripe.com",\n    "days": 5,\n    "jd": "Senior Engineer..."\n  }\n]`}
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono leading-relaxed"
            />
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setBatchJson(
                    JSON.stringify(
                      [
                        {
                          id: "role-1",
                          company_url: "https://stripe.com",
                          days: 5,
                          jd: "Backend Engineer - Payments infrastructure. 4+ years Go/Java.",
                        },
                        {
                          id: "role-2",
                          company_url: "https://posthog.com",
                          days: 3,
                          jd: "Full Stack Engineer - Analytics UI. 3+ years React, TypeScript.",
                        },
                      ],
                      null,
                      2
                    )
                  );
                }}
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Load Example Batch
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Launch Batch
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
