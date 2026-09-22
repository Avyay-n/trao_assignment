import { z } from "zod";

// --- Appendix A Schemas ---

export const RequirementKindSchema = z.enum(["technical", "behavioural", "domain"]);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

export const RequirementPrioritySchema = z.enum(["must", "nice"]);
export type RequirementPriority = z.infer<typeof RequirementPrioritySchema>;

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: RequirementKindSchema,
  priority: RequirementPrioritySchema,
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const QuestionCategorySchema = z.enum(["technical", "behavioural", "system-design", "company-fit"]);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: QuestionCategorySchema,
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
  // Client state metadata (optional in Appendix A export, preserved in backend/state)
  isPinned: z.boolean().optional(),
  origin: z.enum(["generated", "edited", "manual"]).optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  // Practice metadata
  confidence: z.number().int().min(1).max(3).optional(),
  lastReviewed: z.string().optional(),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const ScheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative(),
});
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;

export const ScheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(ScheduleDaySchema),
});
export type Schedule = z.infer<typeof ScheduleSchema>;

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().min(1),
});
export type Coverage = z.infer<typeof CoverageSchema>;

export const SourceInfoSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});
export type SourceInfo = z.infer<typeof SourceInfoSchema>;

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const RoleInfoSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});
export type RoleInfo = z.infer<typeof RoleInfoSchema>;

export const KitSchema = z.object({
  source: SourceInfoSchema,
  company_brief: CompanyBriefSchema,
  role: RoleInfoSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageSchema,
});
export type Kit = z.infer<typeof KitSchema>;

// Strict Appendix A export validator (strips extra state attributes if needed)
export function sanitizeKitForAppendixA(kit: Kit): Kit {
  return {
    source: {
      company: kit.source.company,
      company_url: kit.source.company_url,
      role: kit.source.role,
      location: kit.source.location,
      jd_chars: kit.source.jd_chars,
      researched_at: kit.source.researched_at,
      pages_used: kit.source.pages_used,
    },
    company_brief: {
      summary: kit.company_brief.summary,
      what_they_do: kit.company_brief.what_they_do,
      sources: kit.company_brief.sources,
    },
    role: {
      title: kit.role.title,
      seniority: kit.role.seniority,
      responsibilities: kit.role.responsibilities,
      requirements: kit.role.requirements.map(r => ({
        id: r.id,
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      })),
    },
    questions: kit.questions.map(q => ({
      id: q.id,
      requirement_ids: q.requirement_ids,
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline,
      difficulty: q.difficulty,
    })),
    flashcards: kit.flashcards.map(f => ({
      id: f.id,
      front: f.front,
      back: f.back,
      requirement_ids: f.requirement_ids,
    })),
    schedule: {
      days_available: kit.schedule.days_available,
      days: kit.schedule.days.map(d => ({
        day: d.day,
        focus: d.focus,
        question_ids: d.question_ids,
        minutes: d.minutes,
      })),
    },
    coverage: {
      uncovered_requirement_ids: kit.coverage.uncovered_requirement_ids,
      passes: kit.coverage.passes,
    },
  };
}

// --- Appendix B Schemas ---

export const BatchInputCaseSchema = z.object({
  id: z.string(),
  jd: z.string(),
  company_url: z.string(),
  days: z.number().int().positive(),
});
export type BatchInputCase = z.infer<typeof BatchInputCaseSchema>;

export const BatchInputSchema = z.array(BatchInputCaseSchema);

export const BatchOutputErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type BatchOutputError = z.infer<typeof BatchOutputErrorSchema>;

export const BatchOutputKitEntrySchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "failed"]),
  kit: KitSchema.nullable(),
  error: BatchOutputErrorSchema.nullable(),
});
export type BatchOutputKitEntry = z.infer<typeof BatchOutputKitEntrySchema>;

export const BatchOutputSchema = z.object({
  version: z.string(),
  generated_at: z.string(),
  kits: z.array(BatchOutputKitEntrySchema),
});
export type BatchOutput = z.infer<typeof BatchOutputSchema>;

// Progress callback type for streaming generation updates
export type GenerationProgressCallback = (step: {
  phase: string;
  message: string;
  progress: number;
}) => void;
