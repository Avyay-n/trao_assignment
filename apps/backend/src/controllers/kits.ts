import { Response } from "express";
import mongoose from "mongoose";
import {
  generateInterviewKit,
  reconcileCategoryQuestions,
  evaluateCoverage,
  buildCoverageObject,
  buildSchedule,
  createLLMProvider,
  safeParseJson,
  QuestionCategory,
  Question,
  Kit,
} from "@prepkit/core";
import { KitModel, IKitDocument } from "../models/Kit.js";
import { AuthRequest } from "../middleware/auth.js";

// Active SSE client connections for real-time progress
const sseClients = new Map<string, Response[]>();

function emitProgress(kitId: string, phase: string, message: string, progress: number) {
  const clients = sseClients.get(kitId) || [];
  const payload = JSON.stringify({ kitId, phase, message, progress });
  for (const client of clients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      // Ignore dead connection
    }
  }
}

/**
 * Initiates kit creation and runs generation asynchronously.
 */
export async function createKit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { jd, company_url, days } = req.body;

    if (!jd || !company_url) {
      res.status(400).json({ error: "Job description and company URL are required." });
      return;
    }

    const daysCount = Math.max(1, parseInt(days || "5", 10));

    // Deduce company name
    let companyName = "Target Company";
    try {
      const parsed = new URL(company_url);
      const hostParts = parsed.hostname.replace("www.", "").split(".");
      if (hostParts.length > 0 && hostParts[0] !== "localhost") {
        companyName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
      }
    } catch {}

    const kitDoc = await KitModel.create({
      userId: mongoose.Types.ObjectId.isValid(req.userId || "") ? new mongoose.Types.ObjectId(req.userId) : (req.userId as any),
      title: `${companyName} - Interview Prep Kit`,
      company: companyName,
      company_url,
      days: daysCount,
      jd,
      status: "generating",
      progress: 5,
      progressMessage: "Initializing research crawler...",
    });

    res.status(202).json({ kit: kitDoc });

    // Run generation in background
    runGenerationTask(kitDoc._id.toString(), jd, company_url, daysCount);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Background worker task for kit generation.
 */
async function runGenerationTask(
  kitId: string,
  jd: string,
  company_url: string,
  days: number
) {
  try {
    const llm = createLLMProvider();

    const generatedKit = await generateInterviewKit(
      { jd, company_url, days },
      {
        llmProvider: llm,
        allowLocalUrls: true,
        onProgress: async (p) => {
          emitProgress(kitId, p.phase, p.message, p.progress);
          await KitModel.findByIdAndUpdate(kitId, {
            progress: p.progress,
            progressMessage: p.message,
          });
        },
      }
    );

    await KitModel.findByIdAndUpdate(kitId, {
      status: "ready",
      progress: 100,
      progressMessage: "Kit generation complete!",
      title: `${generatedKit.role.title} at ${generatedKit.source.company}`,
      company: generatedKit.source.company,
      kitData: generatedKit,
    });

    emitProgress(kitId, "completed", "Kit generation complete!", 100);
  } catch (err: any) {
    console.error(`[Kit Generation Error] Kit ${kitId}:`, err);
    await KitModel.findByIdAndUpdate(kitId, {
      status: "failed",
      progress: 100,
      error: err.message || "Failed to generate interview kit.",
      progressMessage: "Generation failed.",
    });
    emitProgress(kitId, "failed", err.message || "Generation failed.", 100);
  }
}

/**
 * Server-Sent Events stream for real-time generation feedback.
 */
export async function streamKitProgress(req: AuthRequest, res: Response): Promise<void> {
  const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const currentClients = sseClients.get(id) || [];
  currentClients.push(res);
  sseClients.set(id, currentClients);

  req.on("close", () => {
    const remaining = (sseClients.get(id) || []).filter((c) => c !== res);
    sseClients.set(id, remaining);
  });
}

/**
 * Lists all kits for the authenticated user.
 */
export async function listKits(req: AuthRequest, res: Response): Promise<void> {
  try {
    const kits = await KitModel.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("-jd");
    res.json({ kits });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Retrieves a single kit.
 */
export async function getKit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id as string, userId: req.userId });
    if (!kit) {
      res.status(404).json({ error: "Kit not found." });
      return;
    }
    res.json({ kit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Saves modified kit state (Builder edits, reordering, pin toggles).
 */
export async function updateKit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { kitData } = req.body;
    const kit = await KitModel.findOne({ _id: req.params.id as string, userId: req.userId });

    if (!kit) {
      res.status(404).json({ error: "Kit not found." });
      return;
    }

    if (kitData) {
      // Re-evaluate coverage deterministically
      if (kitData.role?.requirements && kitData.questions) {
        kitData.coverage = buildCoverageObject(
          kitData.role.requirements,
          kitData.questions,
          kitData.coverage?.passes || 1
        );
      }
      kit.kitData = kitData;
      kit.markModified("kitData");
    }

    await kit.save();
    res.json({ kit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Regenerates a single section on its own while strictly preserving edits elsewhere!
 * Section 6: Builder requirement.
 */
export async function regenerateSection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { section, category } = req.body; // section: "brief" | "schedule" | "category"
    const kitDoc = await KitModel.findOne({ _id: id, userId: req.userId });

    if (!kitDoc || !kitDoc.kitData) {
      res.status(404).json({ error: "Kit not found or not ready." });
      return;
    }

    const kit: Kit = kitDoc.kitData;
    const llm = createLLMProvider();

    if (section === "category") {
      const targetCategory = category as QuestionCategory;
      if (!["technical", "behavioural", "system-design", "company-fit"].includes(targetCategory)) {
        res.status(400).json({ error: "Invalid question category specified." });
        return;
      }

      // Generate fresh questions for target category
      const targetReqs = kit.role.requirements.filter(
        (r) => targetCategory === "behavioural" ? r.kind === "behavioural" : true
      );

      const prompt = `Generate 3 fresh, insightful interview questions in category "${targetCategory}" for role "${kit.role.title}" at "${kit.source.company}".
Requirements context:
${JSON.stringify(targetReqs.slice(0, 4))}

Return strictly a JSON array:
[
  {
    "id": "q_new",
    "requirement_ids": ["${targetReqs[0]?.id || "r1"}"],
    "category": "${targetCategory}",
    "prompt": string,
    "answer_outline": string,
    "difficulty": 2
  }
]`;

      const aiRes = await llm.complete(
        [
          { role: "system", content: "You generate interview questions. Output strictly valid JSON array." },
          { role: "user", content: prompt },
        ],
        { responseFormatJson: true }
      );

      const freshQuestions: Question[] = safeParseJson<Question[]>(aiRes, []);

      // Run state reconciliation engine to strictly preserve pinned, edited, and manual items!
      kit.questions = reconcileCategoryQuestions(kit.questions, freshQuestions, targetCategory);

      // Re-evaluate coverage and update schedule
      kit.coverage = buildCoverageObject(kit.role.requirements, kit.questions, (kit.coverage.passes || 1) + 1);
      kit.schedule = buildSchedule(kit.schedule.days_available, kit.questions, kit.role.requirements);
    } else if (section === "schedule") {
      // Pure deterministic schedule re-allocation
      kit.schedule = buildSchedule(kit.schedule.days_available, kit.questions, kit.role.requirements);
    } else if (section === "brief") {
      // Regenerate brief
      const prompt = `Write a refreshed company brief for ${kit.source.company} (${kit.source.company_url}).
Return strictly valid JSON:
{
  "summary": string,
  "what_they_do": string,
  "sources": string[]
}`;
      const briefRes = await llm.complete(
        [
          { role: "system", content: "You write concise company briefs. Output JSON." },
          { role: "user", content: prompt },
        ],
        { responseFormatJson: true }
      );
      const newBrief = safeParseJson(briefRes, kit.company_brief);
      kit.company_brief = {
        summary: newBrief.summary || kit.company_brief.summary,
        what_they_do: newBrief.what_they_do || kit.company_brief.what_they_do,
        sources: kit.company_brief.sources,
      };
    } else {
      res.status(400).json({ error: "Unsupported section for regeneration." });
      return;
    }

    kitDoc.kitData = kit;
    kitDoc.markModified("kitData");
    await kitDoc.save();

    res.json({ kit: kitDoc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Records flashcard confidence rating during practice mode (Section 7).
 */
export async function recordPracticeConfidence(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { cardId, confidence } = req.body; // confidence: 1 (hard), 2 (good), 3 (easy)

    if (!cardId || ![1, 2, 3].includes(confidence)) {
      res.status(400).json({ error: "Valid cardId and confidence rating (1, 2, or 3) required." });
      return;
    }

    const kitDoc = await KitModel.findOne({ _id: id, userId: req.userId });
    if (!kitDoc) {
      res.status(404).json({ error: "Kit not found." });
      return;
    }

    if (!kitDoc.flashcardConfidence) {
      kitDoc.flashcardConfidence = {};
    }
    kitDoc.flashcardConfidence[cardId] = confidence;
    kitDoc.markModified("flashcardConfidence");
    await kitDoc.save();

    res.json({ flashcardConfidence: kitDoc.flashcardConfidence });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Creative Feature: Interactive AI Mock Interview Answer Evaluator & Weak-Spot Diagnostics.
 */
export async function evaluateMockInterviewAnswer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { questionId, userAnswer } = req.body;

    if (!questionId || !userAnswer) {
      res.status(400).json({ error: "questionId and userAnswer are required." });
      return;
    }

    const kitDoc = await KitModel.findOne({ _id: id, userId: req.userId });
    if (!kitDoc || !kitDoc.kitData) {
      res.status(404).json({ error: "Kit not found." });
      return;
    }

    const targetQuestion = kitDoc.kitData.questions.find((q: Question) => q.id === questionId);
    if (!targetQuestion) {
      res.status(404).json({ error: "Question not found in this kit." });
      return;
    }

    const llm = createLLMProvider();

    const evalPrompt = `You are a Principal Engineer and Bar-Raiser conducting a mock interview for the role of "${kitDoc.kitData.role.title}".

Question Prompt:
"""
${targetQuestion.prompt}
"""

Model Answer Outline & Benchmarks:
"""
${targetQuestion.answer_outline}
"""

Candidate's Answer:
"""
${userAnswer}
"""

EVALUATE THE ANSWER RIGOROUSLY:
1. Overall score from 1 (poor) to 10 (exceptional).
2. Criteria scores (1-10) for:
   - technicalAccuracy
   - structureAndClarity
   - starFramework (if behavioural, otherwise architectural coherence)
3. 2-3 specific Strengths.
4. 2-3 specific Weak Spots or blind spots.
5. Recommended actionable improvements.

Return strictly valid JSON:
{
  "overallScore": number,
  "criteriaScores": {
    "technicalAccuracy": number,
    "structureAndClarity": number,
    "starFramework": number
  },
  "strengths": string[],
  "weakSpots": string[],
  "recommendedImprovements": string
}`;

    const evalRes = await llm.complete(
      [
        { role: "system", content: "You are an expert technical interviewer evaluating candidates. Output strictly valid JSON." },
        { role: "user", content: evalPrompt },
      ],
      { responseFormatJson: true, temperature: 0.2 }
    );

    const parsedEval = safeParseJson(evalRes, {
      overallScore: 7,
      criteriaScores: { technicalAccuracy: 7, structureAndClarity: 7, starFramework: 7 },
      strengths: ["Clear communication of core concepts", "Direct address of the question prompt"],
      weakSpots: ["Could elaborate more on edge-cases and operational resilience"],
      recommendedImprovements: "Structure your explanation with clear architectural layers and quantify the impact.",
    });

    const attempt = {
      id: `attempt_${Date.now()}`,
      questionId,
      questionPrompt: targetQuestion.prompt,
      userAnswer,
      overallScore: parsedEval.overallScore,
      criteriaScores: parsedEval.criteriaScores,
      strengths: parsedEval.strengths,
      weakSpots: parsedEval.weakSpots,
      recommendedImprovements: parsedEval.recommendedImprovements,
      evaluatedAt: new Date().toISOString(),
    };

    kitDoc.mockInterviews.unshift(attempt);
    await kitDoc.save();

    res.json({ attempt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Batch upload of description-company pairs (Section 2).
 */
export async function batchCreateKits(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { cases } = req.body; // Array of { jd, company_url, days }

    if (!Array.isArray(cases) || cases.length === 0) {
      res.status(400).json({ error: "An array of cases with jd and company_url is required." });
      return;
    }

    const createdKits: IKitDocument[] = [];

    for (const c of cases) {
      const daysCount = Math.max(1, parseInt(c.days || "5", 10));
      let companyName = "Company";
      try {
        const parsed = new URL(c.company_url);
        const hostParts = parsed.hostname.replace("www.", "").split(".");
        if (hostParts.length > 0 && hostParts[0] !== "localhost") {
          companyName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
        }
      } catch {}

      const kitDoc = await KitModel.create({
        userId: mongoose.Types.ObjectId.isValid(req.userId || "") ? new mongoose.Types.ObjectId(req.userId) : (req.userId as any),
        title: `${companyName} - Interview Prep Kit`,
        company: companyName,
        company_url: c.company_url,
        days: daysCount,
        jd: c.jd,
        status: "generating",
        progress: 5,
        progressMessage: "Queued for batch generation",
      });

      createdKits.push(kitDoc);
      // Run generation in background
      runGenerationTask(kitDoc._id.toString(), c.jd, c.company_url, daysCount);
    }

    res.status(202).json({ kits: createdKits });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Deletes a kit.
 */
export async function deleteKit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await KitModel.deleteOne({ _id: req.params.id as string, userId: req.userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Kit not found." });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
