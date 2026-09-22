"use client";

import React, { useState } from "react";
import {
  Mic,
  Send,
  Sparkles,
  Award,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BrainCircuit,
  Loader2,
} from "lucide-react";
import { Kit, Question } from "@prepkit/core";
import { fetchApi } from "@/lib/api";

interface MockInterviewViewProps {
  kitId: string;
  kit: Kit;
  existingAttempts?: any[];
}

export const MockInterviewView: React.FC<MockInterviewViewProps> = ({
  kitId,
  kit,
  existingAttempts = [],
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    kit.questions[0]?.id || ""
  );
  const [userAnswer, setUserAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [latestAttempt, setLatestAttempt] = useState<any | null>(
    existingAttempts[0] || null
  );
  const [attempts, setAttempts] = useState<any[]>(existingAttempts);

  const activeQuestion: Question | undefined = kit.questions.find(
    (q) => q.id === selectedQuestionId
  );

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || !selectedQuestionId) return;

    setIsEvaluating(true);

    try {
      const res = await fetchApi<{ attempt: any }>(`/kits/${kitId}/mock-interview`, {
        method: "POST",
        body: JSON.stringify({
          questionId: selectedQuestionId,
          userAnswer: userAnswer.trim(),
        }),
      });

      if (res.attempt) {
        setLatestAttempt(res.attempt);
        setAttempts([res.attempt, ...attempts]);
        setUserAnswer("");
      }
    } catch (err: any) {
      alert(`Evaluation error: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Creative Feature Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">AI Mock Interview Simulator</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Creative Feature
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Practice answering kit questions. An AI Bar-Raiser will score your answer, check STAR adherence, and diagnose weak spots.
            </p>
          </div>
        </div>

        {attempts.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400">Total Attempts:</span>
            <span className="font-bold text-slate-200">{attempts.length}</span>
          </div>
        )}
      </div>

      {/* Question Selector & Simulator Room */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            Select Question to Answer:
          </label>
          <select
            value={selectedQuestionId}
            onChange={(e) => setSelectedQuestionId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm font-medium"
          >
            {kit.questions.map((q) => (
              <option key={q.id} value={q.id}>
                [{q.category.toUpperCase()}] (Diff: {q.difficulty}/3) {q.prompt}
              </option>
            ))}
          </select>
        </div>

        {activeQuestion && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                {activeQuestion.id}
              </span>
              <span className="capitalize font-medium text-slate-300">{activeQuestion.category}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Target Difficulty: {activeQuestion.difficulty}/3</span>
            </div>
            <h4 className="text-base font-semibold text-white leading-relaxed">
              "{activeQuestion.prompt}"
            </h4>
          </div>
        )}

        {/* Answer Form */}
        <form onSubmit={handleSubmitAnswer} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Your Spoken or Written Response:</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setUserAnswer(
                    activeQuestion?.category === "behavioural"
                      ? "In my previous role, our team faced a bottleneck where API response times spiked to 4 seconds. As lead, I profiled the database queries and realized missing composite indexes caused full table scans. I coordinated with operations to roll out non-blocking index creations and implemented a Redis read-through cache, reducing p99 latency to 120ms within two sprints."
                      : "To address this architecture challenge, I would decouple the ingestion layer using an event log like Kafka. Producers append immutable events, and consumer worker groups process messages idempotently with distributed locks in Redis. For fault tolerance, unprocessable events are routed to a dead letter queue with automated retries and alerting."
                  );
                }}
                className="text-[11px] text-purple-400 hover:underline"
              >
                Insert Sample Response
              </button>
            </div>
            <textarea
              required
              rows={6}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Structure your answer clearly. For behavioural questions, utilize Situation, Task, Action, and Result (STAR)..."
              className="w-full px-4 py-3 rounded-xl glass-input text-xs sm:text-sm font-sans leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isEvaluating || !userAnswer.trim()}
              className="flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI Bar-Raiser Evaluating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Submit Answer for Evaluation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Latest Evaluation Report */}
      {latestAttempt && (
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-purple-500/30 space-y-6 shadow-xl shadow-purple-500/5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-purple-400 font-mono">
                Bar-Raiser Evaluation Results
              </span>
              <h4 className="text-lg font-bold text-white mt-0.5">Readiness Diagnostic</h4>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Overall Score</span>
                <span className="text-2xl font-black text-purple-400 font-mono">
                  {latestAttempt.overallScore}/10
                </span>
              </div>
            </div>
          </div>

          {/* Criteria Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400">Technical Depth</span>
              <p className="text-lg font-bold font-mono text-indigo-400 mt-1">
                {latestAttempt.criteriaScores?.technicalAccuracy ?? 8}/10
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400">Structure & Clarity</span>
              <p className="text-lg font-bold font-mono text-purple-400 mt-1">
                {latestAttempt.criteriaScores?.structureAndClarity ?? 7}/10
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400">Framework Alignment</span>
              <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
                {latestAttempt.criteriaScores?.starFramework ?? 8}/10
              </p>
            </div>
          </div>

          {/* Strengths & Weak Spots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Identified Strengths</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {latestAttempt.strengths?.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-400">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weak Spots */}
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Weak Spots & Blind Spots</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {latestAttempt.weakSpots?.map((w: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-400">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Recommended Improvements:
            </span>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {latestAttempt.recommendedImprovements}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
