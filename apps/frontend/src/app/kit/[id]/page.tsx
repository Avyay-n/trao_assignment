"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Layers,
  BookOpen,
  BrainCircuit,
  FileText,
  Loader2,
  AlertCircle,
  Clock,
  Building,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Kit } from "@prepkit/core";
import { Navbar } from "@/components/Navbar";
import { BuilderView } from "@/components/BuilderView";
import { ScheduleView } from "@/components/ScheduleView";
import { PracticeView } from "@/components/PracticeView";
import { MockInterviewView } from "@/components/MockInterviewView";
import { ExportView } from "@/components/ExportView";
import { NewKitModal } from "@/components/NewKitModal";
import { User, fetchApi, getStoredToken, clearStoredToken, API_BASE } from "@/lib/api";

type TabType = "builder" | "schedule" | "practice" | "mock" | "export";

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const kitId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "builder"
  );
  const [kitRecord, setKitRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewKitModalOpen, setIsNewKitModalOpen] = useState(false);

  useEffect(() => {
    loadUserAndKit();
  }, [kitId]);

  const loadUserAndKit = async () => {
    try {
      const userData = await fetchApi<{ user: User }>("/auth/me");
      setUser(userData.user);

      const res = await fetchApi<{ kit: any }>(`/kits/${kitId}`);
      setKitRecord(res.kit);

      // If currently generating, listen to SSE stream
      if (res.kit.status === "generating") {
        subscribeToProgress();
      }
    } catch (err: any) {
      setError(err.message || "Failed to load kit.");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToProgress = () => {
    const eventSource = new EventSource(`${API_BASE}/kits/${kitId}/stream`);

    eventSource.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.phase === "completed" || payload.progress >= 100) {
          eventSource.close();
          const refreshed = await fetchApi<{ kit: any }>(`/kits/${kitId}`);
          setKitRecord(refreshed.kit);
        } else if (payload.phase === "failed") {
          eventSource.close();
          const refreshed = await fetchApi<{ kit: any }>(`/kits/${kitId}`);
          setKitRecord(refreshed.kit);
        } else {
          setKitRecord((prev: any) =>
            prev ? { ...prev, progress: payload.progress, progressMessage: payload.message } : prev
          );
        }
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  const handleKitUpdate = (updatedKit: Kit) => {
    setKitRecord((prev: any) => ({
      ...prev,
      kitData: updatedKit,
    }));
  };

  const handleLogout = () => {
    clearStoredToken();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading interview preparation kit...</p>
        </div>
      </div>
    );
  }

  if (error || !kitRecord) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel rounded-2xl p-8 max-w-md text-center border border-slate-800 space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Unable to open kit</h3>
          <p className="text-xs text-slate-400">{error || "Kit could not be found."}</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Still generating screen
  if (kitRecord.status === "generating") {
    return (
      <>
        <Navbar
          user={user}
          onOpenNewKit={() => setIsNewKitModalOpen(true)}
          onDemoLogin={() => {}}
          onLogout={handleLogout}
        />
        <div className="max-w-2xl mx-auto px-4 py-24 text-center space-y-6">
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <Sparkles className="w-8 h-8 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Generating Your Prep Kit
            </h2>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              {kitRecord.progressMessage || "Crawling company pages and executing deliberate generation passes..."}
            </p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden max-w-md mx-auto">
            <div
              className="bg-indigo-500 h-2 transition-all duration-300 rounded-full"
              style={{ width: `${kitRecord.progress || 10}%` }}
            />
          </div>
          <span className="text-xs font-mono text-indigo-400 font-bold">
            {kitRecord.progress || 10}% completed
          </span>
        </div>
      </>
    );
  }

  // Failed state screen
  if (kitRecord.status === "failed") {
    return (
      <>
        <Navbar
          user={user}
          onOpenNewKit={() => setIsNewKitModalOpen(true)}
          onDemoLogin={() => {}}
          onLogout={handleLogout}
        />
        <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Generation Failed</h2>
          <p className="text-xs text-rose-300 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 leading-relaxed">
            {kitRecord.error || "An unexpected error interrupted kit generation."}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  const kit: Kit = kitRecord.kitData;

  return (
    <>
      <Navbar
        user={user}
        onOpenNewKit={() => setIsNewKitModalOpen(true)}
        onDemoLogin={() => {}}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full space-y-6">
        {/* Breadcrumb & Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {kit.role.title}
              </h1>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {kit.source.company}
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                {kit.schedule.days_available} {kit.schedule.days_available === 1 ? "day" : "days"} prep
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-px overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("builder")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "builder"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Reshapeable Builder</span>
          </button>

          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "schedule"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Study Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab("practice")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "practice"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Flashcards Practice</span>
          </button>

          <button
            onClick={() => setActiveTab("mock")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "mock"
                ? "border-purple-500 text-purple-400 bg-purple-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BrainCircuit className="w-4 h-4 text-purple-400" />
            <span className="flex items-center gap-1.5">
              <span>AI Mock Interview</span>
              <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                Creative
              </span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab("export")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "export"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Cheat-Sheet & Export</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        {activeTab === "builder" && (
          <BuilderView kitId={kitId} kit={kit} onUpdate={handleKitUpdate} />
        )}

        {activeTab === "schedule" && (
          <ScheduleView kitId={kitId} kit={kit} onUpdate={handleKitUpdate} />
        )}

        {activeTab === "practice" && (
          <PracticeView
            kitId={kitId}
            kit={kit}
            initialConfidenceMap={kitRecord.flashcardConfidence || {}}
          />
        )}

        {activeTab === "mock" && (
          <MockInterviewView
            kitId={kitId}
            kit={kit}
            existingAttempts={kitRecord.mockInterviews || []}
          />
        )}

        {activeTab === "export" && <ExportView kit={kit} />}
      </main>

      <NewKitModal
        isOpen={isNewKitModalOpen}
        onClose={() => setIsNewKitModalOpen(false)}
        onKitCreated={(newId) => {
          setIsNewKitModalOpen(false);
          router.push(`/kit/${newId}`);
        }}
      />
    </>
  );
}
