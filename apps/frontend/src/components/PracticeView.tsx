"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Keyboard,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Flashcard, Kit } from "@prepkit/core";
import { fetchApi } from "@/lib/api";

interface PracticeViewProps {
  kitId: string;
  kit: Kit;
  initialConfidenceMap?: Record<string, number>;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  kitId,
  kit,
  initialConfidenceMap = {},
}) => {
  const [confidenceMap, setConfidenceMap] = useState<Record<string, number>>(initialConfidenceMap);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Spaced-repetition / confidence-weighted ordering (Section 7)
  // Cards with lowest confidence (1 or unrated) surface first!
  const sortedCards = useMemo(() => {
    return [...kit.flashcards].sort((a, b) => {
      const confA = confidenceMap[a.id] ?? 0;
      const confB = confidenceMap[b.id] ?? 0;
      return confA - confB; // ascending: 0 (unreviewed) and 1 (hard) first
    });
  }, [kit.flashcards, confidenceMap]);

  const currentCard: Flashcard | undefined = sortedCards[currentIndex];

  // Record confidence rating: 1 (Hard), 2 (Good), 3 (Easy)
  const handleRate = async (confidence: number) => {
    if (!currentCard) return;

    const newMap = { ...confidenceMap, [currentCard.id]: confidence };
    setConfidenceMap(newMap);
    setIsFlipped(false);

    // Save to backend
    try {
      await fetchApi(`/kits/${kitId}/practice`, {
        method: "POST",
        body: JSON.stringify({ cardId: currentCard.id, confidence }),
      });
    } catch (err) {
      console.error("Failed to save confidence rating:", err);
    }

    // Advance to next card
    if (currentIndex < sortedCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Loop back to lowest confidence cards
      setCurrentIndex(0);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === "1") {
        e.preventDefault();
        handleRate(1);
      } else if (e.key === "2") {
        e.preventDefault();
        handleRate(2);
      } else if (e.key === "3") {
        e.preventDefault();
        handleRate(3);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < sortedCards.length - 1) {
          setIsFlipped(false);
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) {
          setIsFlipped(false);
          setCurrentIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCard, currentIndex, sortedCards.length]);

  // Mastery stats
  const totalCards = kit.flashcards.length;
  const reviewedCount = Object.keys(confidenceMap).length;
  const masteredCount = Object.values(confidenceMap).filter((c) => c === 3).length;
  const masteryPercent = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  if (!currentCard) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center">
        <p className="text-slate-400">No flashcards available in this kit.</p>
      </div>
    );
  }

  const currentConfidence = confidenceMap[currentCard.id];

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Progress Header */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
            Card {currentIndex + 1} of {totalCards}
          </span>
          <h4 className="text-base font-bold text-white tracking-tight mt-0.5">Flashcard Practice Drill</h4>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">Covered</span>
            <span className="font-bold text-slate-200">
              {reviewedCount}/{totalCards} ({Math.round((reviewedCount / totalCards) * 100)}%)
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">Mastered (Easy)</span>
            <span className="font-bold text-emerald-400">{masteryPercent}%</span>
          </div>
        </div>
      </div>

      {/* 3D Flashcard */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="w-full min-h-[320px] sm:min-h-[360px] cursor-pointer perspective-1000 group select-none"
      >
        <div
          className={`relative w-full h-full min-h-[320px] sm:min-h-[360px] rounded-3xl p-8 glass-panel border transition-transform duration-500 transform-style-3d flex flex-col justify-between ${
            isFlipped
              ? "rotate-y-180 border-indigo-500/50 shadow-xl shadow-indigo-500/10"
              : "border-slate-700/80 hover:border-slate-600 shadow-xl"
          }`}
        >
          {/* FRONT */}
          {!isFlipped ? (
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  {currentCard.id}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Click or press Space to reveal answer
                </span>
              </div>

              <div className="my-auto py-6 text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
                  {currentCard.front}
                </h3>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Requirement: {currentCard.requirement_ids?.join(", ") || "General"}</span>
                {currentConfidence && (
                  <span
                    className={`font-medium px-2 py-0.5 rounded ${
                      currentConfidence === 3
                        ? "text-emerald-400 bg-emerald-500/10"
                        : currentConfidence === 2
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-rose-400 bg-rose-500/10"
                    }`}
                  >
                    Current: {currentConfidence === 3 ? "Easy" : currentConfidence === 2 ? "Good" : "Hard"}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* BACK */
            <div className="flex-1 flex flex-col justify-between rotate-y-180">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Model Answer & Explanation
                </span>
                <span className="text-xs text-slate-400">Click to flip back</span>
              </div>

              <div className="my-auto py-4">
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed text-left">
                  {currentCard.back}
                </p>
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Press 1 (Hard), 2 (Good), or 3 (Easy) to score & advance
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rating & Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsFlipped(false);
              setCurrentIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={currentIndex === 0}
            className="p-2.5 rounded-xl glass-card text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsFlipped(false);
              setCurrentIndex((prev) => Math.min(sortedCards.length - 1, prev + 1));
            }}
            disabled={currentIndex === sortedCards.length - 1}
            className="p-2.5 rounded-xl glass-card text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Confidence Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRate(1)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all active:scale-95"
          >
            <span className="w-4 h-4 rounded bg-rose-500/30 flex items-center justify-center font-mono text-[10px]">1</span>
            <span>Hard / Again</span>
          </button>
          <button
            onClick={() => handleRate(2)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all active:scale-95"
          >
            <span className="w-4 h-4 rounded bg-amber-500/30 flex items-center justify-center font-mono text-[10px]">2</span>
            <span>Good</span>
          </button>
          <button
            onClick={() => handleRate(3)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95"
          >
            <span className="w-4 h-4 rounded bg-emerald-500/30 flex items-center justify-center font-mono text-[10px]">3</span>
            <span>Easy / Mastered</span>
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Guide */}
      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-4">
        <span className="flex items-center gap-1 font-mono">
          <Keyboard className="w-3.5 h-3.5 text-indigo-400" /> Shortcuts:
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Space</kbd> Flip
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">1</kbd> Hard
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">2</kbd> Good
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">3</kbd> Easy
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">←</kbd> /{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">→</kbd> Navigate
        </span>
      </div>
    </div>
  );
};
