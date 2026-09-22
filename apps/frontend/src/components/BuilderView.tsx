"use client";

import React, { useState } from "react";
import {
  Pin,
  PinOff,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  Check,
  Building,
  Target,
  HelpCircle,
  ShieldAlert,
  ArrowRightLeft,
  ChevronDown,
} from "lucide-react";
import { Kit, Question, QuestionCategory } from "@prepkit/core";
import { fetchApi } from "@/lib/api";

interface BuilderViewProps {
  kitId: string;
  kit: Kit;
  onUpdate: (updatedKit: Kit) => void;
}

const CATEGORIES: { key: QuestionCategory; label: string; color: string }[] = [
  { key: "technical", label: "Technical Core", color: "indigo" },
  { key: "system-design", label: "System Design & Architecture", color: "purple" },
  { key: "behavioural", label: "Behavioural & Leadership", color: "emerald" },
  { key: "company-fit", label: "Company Fit & Values", color: "amber" },
];

export const BuilderView: React.FC<BuilderViewProps> = ({ kitId, kit, onUpdate }) => {
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editOutline, setEditOutline] = useState("");
  const [editDifficulty, setEditDifficulty] = useState(2);

  // Brief editing
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [briefSummary, setBriefSummary] = useState(kit.company_brief.summary);
  const [briefWhatTheyDo, setBriefWhatTheyDo] = useState(kit.company_brief.what_they_do);

  // Regenerating state indicators
  const [regeneratingCategory, setRegeneratingCategory] = useState<string | null>(null);
  const [regeneratingBrief, setRegeneratingBrief] = useState(false);

  // Toggle Pin on question
  const handleTogglePin = (qId: string) => {
    const updatedQuestions = kit.questions.map((q) => {
      if (q.id === qId) {
        return { ...q, isPinned: !q.isPinned };
      }
      return q;
    });
    const updatedKit = { ...kit, questions: updatedQuestions };
    onUpdate(updatedKit);
    saveKitToServer(updatedKit);
  };

  // Start editing question
  const startEditQuestion = (q: Question) => {
    setEditingQId(q.id);
    setEditPrompt(q.prompt);
    setEditOutline(q.answer_outline);
    setEditDifficulty(q.difficulty);
  };

  // Save inline edit
  const handleSaveQuestionEdit = (qId: string) => {
    const updatedQuestions = kit.questions.map((q) => {
      if (q.id === qId) {
        return {
          ...q,
          prompt: editPrompt,
          answer_outline: editOutline,
          difficulty: editDifficulty,
          origin: (q.origin === "manual" ? "manual" : "edited") as "manual" | "edited",
        };
      }
      return q;
    });
    const updatedKit = { ...kit, questions: updatedQuestions };
    onUpdate(updatedKit);
    setEditingQId(null);
    saveKitToServer(updatedKit);
  };

  // Delete question
  const handleDeleteQuestion = (qId: string) => {
    const updatedQuestions = kit.questions.filter((q) => q.id !== qId);
    const updatedKit = { ...kit, questions: updatedQuestions };
    onUpdate(updatedKit);
    saveKitToServer(updatedKit);
  };

  // Move question to another category
  const handleMoveCategory = (qId: string, newCategory: QuestionCategory) => {
    const updatedQuestions = kit.questions.map((q) => {
      if (q.id === qId) {
        return { ...q, category: newCategory, origin: "edited" as const };
      }
      return q;
    });
    const updatedKit = { ...kit, questions: updatedQuestions };
    onUpdate(updatedKit);
    saveKitToServer(updatedKit);
  };

  // Add question manually
  const handleAddManualQuestion = (category: QuestionCategory) => {
    const newId = `manual_${Date.now().toString(36)}`;
    const newQuestion: Question = {
      id: newId,
      requirement_ids: [kit.role.requirements[0]?.id || "r1"],
      category,
      prompt: "Custom question: Describe how you approach...",
      answer_outline: "Candidate explains key methodology, trade-offs, and verification.",
      difficulty: 2,
      origin: "manual",
      isPinned: true, // Manually added items are automatically pinned/preserved
    };
    const updatedQuestions = [newQuestion, ...kit.questions];
    const updatedKit = { ...kit, questions: updatedQuestions };
    onUpdate(updatedKit);
    saveKitToServer(updatedKit);
    startEditQuestion(newQuestion);
  };

  // Regenerate Category (Section 6: Builder requirement)
  const handleRegenerateCategory = async (category: QuestionCategory) => {
    setRegeneratingCategory(category);
    try {
      const res = await fetchApi<{ kit: { kitData: Kit } }>(`/kits/${kitId}/regenerate-section`, {
        method: "POST",
        body: JSON.stringify({ section: "category", category }),
      });
      if (res.kit?.kitData) {
        onUpdate(res.kit.kitData);
      }
    } catch (err: any) {
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setRegeneratingCategory(null);
    }
  };

  // Save brief edit
  const handleSaveBrief = () => {
    const updatedBrief = {
      ...kit.company_brief,
      summary: briefSummary,
      what_they_do: briefWhatTheyDo,
    };
    const updatedKit = { ...kit, company_brief: updatedBrief };
    onUpdate(updatedKit);
    setIsEditingBrief(false);
    saveKitToServer(updatedKit);
  };

  // Regenerate brief
  const handleRegenerateBrief = async () => {
    setRegeneratingBrief(true);
    try {
      const res = await fetchApi<{ kit: { kitData: Kit } }>(`/kits/${kitId}/regenerate-section`, {
        method: "POST",
        body: JSON.stringify({ section: "brief" }),
      });
      if (res.kit?.kitData) {
        onUpdate(res.kit.kitData);
        setBriefSummary(res.kit.kitData.company_brief.summary);
        setBriefWhatTheyDo(res.kit.kitData.company_brief.what_they_do);
      }
    } catch (err: any) {
      alert(`Regenerating brief failed: ${err.message}`);
    } finally {
      setRegeneratingBrief(false);
    }
  };

  const saveKitToServer = async (kitPayload: Kit) => {
    try {
      await fetchApi(`/kits/${kitId}`, {
        method: "PUT",
        body: JSON.stringify({ kitData: kitPayload }),
      });
    } catch (err) {
      console.error("Auto-save error:", err);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Coverage Status Bar */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${kit.coverage.uncovered_requirement_ids.length === 0 ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Coverage Status:</span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                kit.coverage.uncovered_requirement_ids.length === 0
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                {kit.coverage.uncovered_requirement_ids.length === 0
                  ? "100% Must-Haves Covered"
                  : `${kit.coverage.uncovered_requirement_ids.length} Uncovered Requirements`}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified deterministically in code across {kit.coverage.passes} pass{kit.coverage.passes > 1 ? "es" : ""}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <span>{kit.role.requirements.length} Requirements</span>
          <span>•</span>
          <span>{kit.questions.length} Questions</span>
          <span>•</span>
          <span>{kit.flashcards.length} Flashcards</span>
        </div>
      </div>

      {/* Company Brief Section */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Company Brief & Context</h3>
          </div>
          <div className="flex items-center gap-2">
            {isEditingBrief ? (
              <button
                onClick={handleSaveBrief}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done Editing</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditingBrief(true)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Brief</span>
              </button>
            )}
            <button
              onClick={handleRegenerateBrief}
              disabled={regeneratingBrief}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regeneratingBrief ? "animate-spin" : ""}`} />
              <span>Regenerate Brief</span>
            </button>
          </div>
        </div>

        {isEditingBrief ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400">Summary</label>
              <textarea
                rows={2}
                value={briefSummary}
                onChange={(e) => setBriefSummary(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg glass-input text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400">What They Do</label>
              <textarea
                rows={3}
                value={briefWhatTheyDo}
                onChange={(e) => setBriefWhatTheyDo(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg glass-input text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-slate-300">
            <p className="font-medium text-slate-200 leading-relaxed">{kit.company_brief.summary}</p>
            <p className="text-slate-400 text-xs leading-relaxed">{kit.company_brief.what_they_do}</p>
            {kit.company_brief.sources?.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 font-mono">
                <span className="text-slate-400">Sources:</span>
                {kit.company_brief.sources.map((src, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 truncate max-w-xs">
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role Breakdown & Verified Requirements */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-indigo-400" />
          <h3 className="text-base font-bold text-white tracking-tight">Role Criteria & Extracted Requirements</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Role Title</span>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">{kit.role.title}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Seniority</span>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">{kit.role.seniority}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Researched At</span>
            <p className="text-xs font-mono text-slate-300 mt-1">{new Date(kit.source.researched_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Requirements Tag list */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-400">Extracted Requirements:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {kit.role.requirements.map((req) => (
              <div
                key={req.id}
                className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-2 text-xs"
              >
                <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[10px]">
                  {req.id}
                </span>
                <div className="flex-1">
                  <p className="text-slate-200">{req.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        req.priority === "must"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-700/50 text-slate-400"
                      }`}
                    >
                      {req.priority}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">{req.kind}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categorized Question Bank with Inline Builder */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Interactive Question Bank</h3>
            <p className="text-xs text-slate-400">
              Edit inline, pin custom answers, or regenerate categories. Pinned and edited questions survive regeneration.
            </p>
          </div>
        </div>

        {CATEGORIES.map(({ key, label }) => {
          const categoryQuestions = kit.questions.filter((q) => q.category === key);
          const isRegen = regeneratingCategory === key;

          return (
            <div key={key} className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              {/* Category Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <h4 className="text-base font-semibold text-white">{label}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {categoryQuestions.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddManualQuestion(key)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                  <button
                    onClick={() => handleRegenerateCategory(key)}
                    disabled={isRegen}
                    title="Preserves pinned and edited questions while generating fresh alternatives"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegen ? "animate-spin" : ""}`} />
                    <span>Regenerate Category</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                {categoryQuestions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No questions in this category yet.</p>
                ) : (
                  categoryQuestions.map((q) => {
                    const isEditing = editingQId === q.id;

                    return (
                      <div
                        key={q.id}
                        className={`rounded-xl p-4 transition-all ${
                          q.isPinned
                            ? "bg-slate-900/80 border border-indigo-500/40 shadow-sm shadow-indigo-500/10"
                            : "bg-slate-900/40 border border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {isEditing ? (
                          /* Edit Mode */
                          <div className="space-y-3">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-400">Question Prompt</label>
                              <textarea
                                rows={2}
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                className="w-full mt-1 p-2 rounded-lg glass-input text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-400">Model Answer Outline</label>
                              <textarea
                                rows={3}
                                value={editOutline}
                                onChange={(e) => setEditOutline(e.target.value)}
                                className="w-full mt-1 p-2 rounded-lg glass-input text-xs"
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-400">Difficulty:</label>
                                <select
                                  value={editDifficulty}
                                  onChange={(e) => setEditDifficulty(parseInt(e.target.value, 10))}
                                  className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-200 border border-slate-700"
                                >
                                  <option value={1}>1 - Fundamental</option>
                                  <option value={2}>2 - Intermediate</option>
                                  <option value={3}>3 - Advanced System</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingQId(null)}
                                  className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveQuestionEdit(q.id)}
                                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                                >
                                  Save Edits
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Origin & Pin Badges */}
                                  {q.isPinned && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                      <Pin className="w-2.5 h-2.5" /> Pinned
                                    </span>
                                  )}
                                  {q.origin === "edited" && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Edited
                                    </span>
                                  )}
                                  {q.origin === "manual" && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Manual
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                    Diff: {q.difficulty}/3
                                  </span>
                                  {q.requirement_ids?.map((rId) => (
                                    <span
                                      key={rId}
                                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-300 border border-indigo-800/40"
                                    >
                                      {rId}
                                    </span>
                                  ))}
                                </div>
                                <h5 className="text-sm font-semibold text-slate-100 leading-snug">{q.prompt}</h5>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleTogglePin(q.id)}
                                  title={q.isPinned ? "Unpin question" : "Pin question (preserves across category regeneration)"}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    q.isPinned ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20" : "text-slate-500 hover:text-slate-300"
                                  }`}
                                >
                                  {q.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => startEditQuestion(q)}
                                  title="Edit question prompt or outline"
                                  className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  title="Delete question"
                                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Answer Outline Accordion */}
                            <div className="mt-2.5 p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs text-slate-300">
                              <span className="font-semibold text-[11px] text-slate-400 block mb-1">
                                Expected Answer Outline:
                              </span>
                              <p className="leading-relaxed">{q.answer_outline}</p>
                            </div>

                            {/* Category Transfer Dropdown */}
                            <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-slate-500">
                              <span>Move to:</span>
                              <select
                                value={q.category}
                                onChange={(e) => handleMoveCategory(q.id, e.target.value as QuestionCategory)}
                                className="bg-slate-800 text-slate-300 rounded px-1.5 py-0.5 border border-slate-700 text-[10px]"
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c.key} value={c.key}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
