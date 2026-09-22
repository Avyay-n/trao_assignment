"use client";

import React, { useState } from "react";
import { Calendar, Clock, Sparkles, CheckCircle2, ChevronRight, RefreshCw } from "lucide-react";
import { Kit } from "@prepkit/core";
import { fetchApi } from "@/lib/api";

interface ScheduleViewProps {
  kitId: string;
  kit: Kit;
  onUpdate: (updatedKit: Kit) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ kitId, kit, onUpdate }) => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);

  // Map of questions by ID for fast lookup
  const questionMap = new Map(kit.questions.map((q) => [q.id, q]));

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetchApi<{ kit: { kitData: Kit } }>(`/kits/${kitId}/regenerate-section`, {
        method: "POST",
        body: JSON.stringify({ section: "schedule" }),
      });
      if (res.kit?.kitData) {
        onUpdate(res.kit.kitData);
      }
    } catch (err: any) {
      alert(`Recalculation failed: ${err.message}`);
    } finally {
      setIsRecalculating(false);
    }
  };

  const totalPrepMinutes = kit.schedule.days.reduce((acc, d) => acc + d.minutes, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Schedule Meta Summary */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">Day-by-Day Preparation Roadmap</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministically allocated across {kit.schedule.days_available} days with arithmetic prioritization of must-haves and complex topics.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Total Dedicated Time</span>
            <span className="text-sm font-mono font-bold text-indigo-300">
              {Math.floor(totalPrepMinutes / 60)}h {totalPrepMinutes % 60}m ({totalPrepMinutes} min)
            </span>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
            <span>Re-allocate Schedule</span>
          </button>
        </div>
      </div>

      {/* Grid of Days */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Day Selector Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          {kit.schedule.days.map((d) => {
            const isSelected = selectedDay === d.day;

            return (
              <button
                key={d.day}
                onClick={() => setSelectedDay(d.day)}
                className={`w-full text-left p-4 rounded-xl transition-all flex items-center justify-between ${
                  isSelected
                    ? "bg-indigo-600/20 border border-indigo-500/50 shadow-md shadow-indigo-500/10"
                    : "glass-card border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-400">
                      Day {d.day}
                    </span>
                    <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {d.minutes} min
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-200 line-clamp-1">{d.focus}</h5>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-500 ${isSelected ? "text-indigo-400" : ""}`} />
              </button>
            );
          })}
        </div>

        {/* Selected Day Detail */}
        <div className="lg:col-span-8">
          {(() => {
            const dayData = kit.schedule.days.find((d) => d.day === selectedDay) || kit.schedule.days[0];
            if (!dayData) return null;

            return (
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Day {dayData.day} Plan
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{dayData.minutes} integer minutes allocated</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mt-2">{dayData.focus}</h4>
                </div>

                <div className="space-y-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Assigned Questions ({dayData.question_ids.length})
                  </h5>

                  {dayData.question_ids.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No specific questions scheduled for this review day.</p>
                  ) : (
                    dayData.question_ids.map((qId, idx) => {
                      const q = questionMap.get(qId);
                      if (!q) return null;

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400">
                                {q.id}
                              </span>
                              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300">
                                {q.category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Diff: {q.difficulty}/3
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">~15 min</span>
                          </div>

                          <p className="text-sm font-semibold text-slate-200">{q.prompt}</p>

                          <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400">
                            <span className="font-semibold text-slate-300 block mb-0.5">Strategy / Benchmark:</span>
                            <p className="line-clamp-2">{q.answer_outline}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
