"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  PlusCircle,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  BrainCircuit,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { NewKitModal } from "@/components/NewKitModal";
import { User, fetchApi, getStoredToken, setStoredToken, clearStoredToken } from "@/lib/api";

interface KitSummary {
  _id: string;
  title: string;
  company: string;
  company_url: string;
  days: number;
  status: "generating" | "ready" | "failed";
  progress: number;
  progressMessage: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    checkAuthAndLoadKits();
  }, []);

  const checkAuthAndLoadKits = async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        // Auto-login demo user for immediate evaluation experience
        await handleDemoLogin();
        return;
      }

      const userData = await fetchApi<{ user: User }>("/auth/me");
      setUser(userData.user);

      const kitsData = await fetchApi<{ kits: KitSummary[] }>("/kits");
      setKits(kitsData.kits);
    } catch {
      // If token invalid, try demo login
      await handleDemoLogin();
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      const res = await fetchApi<{ user: User; token: string }>("/auth/demo", {
        method: "POST",
      });
      setStoredToken(res.token);
      setUser(res.user);

      const kitsData = await fetchApi<{ kits: KitSummary[] }>("/kits");
      setKits(kitsData.kits);
    } catch (err) {
      console.error("Demo login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    setKits([]);
    router.push("/login");
  };

  const handleDeleteKit = async (kitId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this prep kit?")) return;

    try {
      await fetchApi(`/kits/${kitId}`, { method: "DELETE" });
      setKits((prev) => prev.filter((k) => k._id !== kitId));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <>
      <Navbar
        user={user}
        onOpenNewKit={() => setIsModalOpen(true)}
        onDemoLogin={handleDemoLogin}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 w-full space-y-10">
        {/* Hero Banner */}
        <div className="relative rounded-3xl p-8 sm:p-12 glass-panel border border-slate-800 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full-Stack AI Interview Intelligence</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Transform Any Job Description into a Personalized Prep Kit.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Deep website crawling, deterministic requirement coverage checking, arithmetic schedule allocation, and an interactive AI mock interviewer.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Prep Kit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Kits Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Your Preparation Kits</h2>
              <p className="text-xs text-slate-400">
                Manage, reshape, and practice against your generated kits.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {kits.length} {kits.length === 1 ? "Kit" : "Kits"} Active
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading your preparation kits...</p>
            </div>
          ) : kits.length === 0 ? (
            /* Empty State */
            <div className="glass-panel rounded-3xl p-12 text-center border border-slate-800 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No prep kits found</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Paste a job description and company URL to generate your first intelligent interview preparation kit.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all"
              >
                Create Your First Kit
              </button>
            </div>
          ) : (
            /* Kit Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {kits.map((kit) => {
                const isReady = kit.status === "ready";
                const isGenerating = kit.status === "generating";

                return (
                  <div
                    key={kit._id}
                    className="glass-card rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      {/* Header tags */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {kit.company}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isReady && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                          {isGenerating && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> Generating...
                            </span>
                          )}
                          {kit.status === "failed" && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertCircle className="w-3 h-3" /> Failed
                            </span>
                          )}
                          <button
                            onClick={(e) => handleDeleteKit(kit._id, e)}
                            title="Delete Kit"
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {kit.title}
                      </h4>

                      {/* Details */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          {kit.days} {kit.days === 1 ? "Day" : "Days"}
                        </span>
                        <span>•</span>
                        <span>{new Date(kit.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Progress bar if generating */}
                      {isGenerating && (
                        <div className="space-y-1.5 pt-2">
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 transition-all rounded-full"
                              style={{ width: `${kit.progress}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{kit.progressMessage}</p>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <Link
                        href={`/kit/${kit._id}`}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 group/btn"
                      >
                        <span>Open Prep Kit</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/kit/${kit._id}?tab=practice`}
                          title="Flashcards Practice"
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                        </Link>
                        <Link
                          href={`/kit/${kit._id}?tab=mock`}
                          title="AI Mock Interview"
                          className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-colors"
                        >
                          <BrainCircuit className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <NewKitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onKitCreated={(kitId) => {
          setIsModalOpen(false);
          router.push(`/kit/${kitId}`);
        }}
      />
    </>
  );
}
