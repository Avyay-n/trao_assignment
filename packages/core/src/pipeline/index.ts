import { crawlCompanySite } from "../crawler/index.js";
import { evaluateCoverage, buildCoverageObject } from "../coverage/index.js";
import { buildSchedule } from "../scheduler/index.js";
import { LLMProvider, createLLMProvider } from "../llm/providers.js";
import { safeParseJson } from "../llm/client.js";
import {
  Kit,
  Question,
  Flashcard,
  Requirement,
  RoleInfo,
  CompanyBrief,
  GenerationProgressCallback,
  sanitizeKitForAppendixA,
} from "../types/index.js";

export interface PipelineOptions {
  llmProvider?: LLMProvider;
  onProgress?: GenerationProgressCallback;
  allowLocalUrls?: boolean;
  maxCoveragePasses?: number;
}

export interface PipelineInput {
  jd: string;
  company_url: string;
  days: number;
}

/**
 * End-to-end multi-step generation pipeline for the AI Interview Prep Kit.
 */
export async function generateInterviewKit(
  input: PipelineInput,
  options: PipelineOptions = {}
): Promise<Kit> {
  const llm = options.llmProvider || createLLMProvider();
  const onProgress = options.onProgress || (() => {});
  const maxPasses = options.maxCoveragePasses ?? 2;

  const jdChars = input.jd.length;
  const researchedAt = new Date().toISOString();

  // -------------------------------------------------------------
  // Step 1: Crawl & Research Company Website
  // -------------------------------------------------------------
  onProgress({
    phase: "crawling",
    message: `Connecting to ${input.company_url} and analyzing site structure...`,
    progress: 10,
  });

  const crawlResult = await crawlCompanySite(input.company_url, {
    allowLocalUrls: options.allowLocalUrls,
  });

  const pagesUsed = crawlResult.pagesUsed.length > 0 ? crawlResult.pagesUsed : [input.company_url];

  // -------------------------------------------------------------
  // Step 2: Extract Role Requirements from JD (Prompt 1)
  // -------------------------------------------------------------
  onProgress({
    phase: "extraction",
    message: "Extracting verified requirements and responsibilities from job description...",
    progress: 25,
  });

  const extractionPrompt = `You are a rigorous technical recruiter analyzing a job posting.
Extract the role title, seniority level (Junior, Mid, Senior, Lead, Staff, Principal, Executive), key responsibilities, and explicit requirements.

CRITICAL INSTRUCTIONS:
1. ONLY extract requirements explicitly stated or clearly implied by the text. DO NOT invent skills, years of experience, or frameworks that are absent.
2. If the posting is short or thin (e.g. 2-3 lines), return an honest, thin list representing only what is written.
3. Classify each requirement priority strictly as "must" (mandatory/core/required/dealbreaker) or "nice" (preferred/bonus/plus/familiarity).
4. Classify each requirement kind strictly as "technical", "behavioural", or "domain".
5. Give each requirement a stable ID starting with r1, r2, etc.

Job Description:
"""
${input.jd}
"""

Return strictly valid JSON with this shape:
{
  "title": string,
  "seniority": string,
  "responsibilities": string[],
  "requirements": [
    { "id": "r1", "text": string, "kind": "technical" | "behavioural" | "domain", "priority": "must" | "nice" }
  ]
}`;

  const extractionRes = await llm.complete(
    [
      { role: "system", content: "You extract structured job criteria. Output strictly valid JSON." },
      { role: "user", content: extractionPrompt },
    ],
    { responseFormatJson: true, temperature: 0.1 }
  );

  const parsedRole: RoleInfo = safeParseJson<RoleInfo>(extractionRes, {
    title: "Software Engineer",
    seniority: "Mid",
    responsibilities: ["Develop and maintain software applications according to team guidelines."],
    requirements: [
      { id: "r1", text: "Software engineering and problem-solving experience", kind: "technical", priority: "must" },
    ],
  });

  // Ensure requirements always have IDs and valid priority/kind
  const validatedRequirements: Requirement[] = (parsedRole.requirements || []).map((r, i) => ({
    id: r.id || `r${i + 1}`,
    text: r.text || "Demonstrated professional experience in relevant domain",
    kind: (["technical", "behavioural", "domain"].includes(r.kind) ? r.kind : "technical") as any,
    priority: (["must", "nice"].includes(r.priority) ? r.priority : "must") as any,
  }));

  // Deduce company name from URL or title
  let companyName = "Target Company";
  try {
    const parsedUrl = new URL(input.company_url);
    const hostParts = parsedUrl.hostname.replace("www.", "").split(".");
    if (hostParts.length > 0 && hostParts[0] !== "localhost") {
      companyName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
    }
  } catch {
    // Keep fallback
  }

  // -------------------------------------------------------------
  // Step 3: Generate Company Brief (Prompt 2)
  // -------------------------------------------------------------
  onProgress({
    phase: "brief",
    message: "Synthesizing company brief and hiring intelligence...",
    progress: 40,
  });

  const crawledContext = crawlResult.pages
    .map((p) => `URL: ${p.url}\nTitle: ${p.title}\nContent:\n${p.text.slice(0, 2500)}`)
    .join("\n---\n");

  const briefPrompt = `You are an interview intelligence researcher.
Write an honest company brief based on the crawled pages below.
If the pages are unreachable, minimal, or contain no information, state that honestly without inventing facts.

Company URL: ${input.company_url}
Crawled Content:
"""
${crawledContext || "No pages could be retrieved from the company URL."}
"""

Return strictly valid JSON with this shape:
{
  "summary": string,
  "what_they_do": string,
  "sources": string[]
}`;

  const briefRes = await llm.complete(
    [
      { role: "system", content: "You synthesize company information honestly. Output strictly valid JSON." },
      { role: "user", content: briefPrompt },
    ],
    { responseFormatJson: true, temperature: 0.2 }
  );

  const parsedBrief: CompanyBrief = safeParseJson<CompanyBrief>(briefRes, {
    summary: crawlResult.error
      ? `Company site was unreachable (${crawlResult.error}). Brief synthesized from job context.`
      : `${companyName} engineering team.`,
    what_they_do: "Operates technology services and engineering solutions.",
    sources: pagesUsed,
  });

  // Ensure sources array exists and matches pages_used
  if (!parsedBrief.sources || parsedBrief.sources.length === 0) {
    parsedBrief.sources = pagesUsed;
  }

  // -------------------------------------------------------------
  // Step 4: Generate Categorized Questions (Prompt 3 & 4)
  // -------------------------------------------------------------
  onProgress({
    phase: "questions",
    message: "Generating categorized interview questions mapped to requirements...",
    progress: 60,
  });

  // Group requirements to generate tailored questions
  const techReqs = validatedRequirements.filter((r) => r.kind === "technical");
  const behavReqs = validatedRequirements.filter((r) => r.kind === "behavioural");
  const domainReqs = validatedRequirements.filter((r) => r.kind === "domain");

  const questionPrompt = `Generate a rigorous interview question bank for the role of "${parsedRole.title}" (${parsedRole.seniority}) at "${companyName}".

Extracted Requirements:
${JSON.stringify(validatedRequirements, null, 2)}

Company Intelligence & Hiring Context:
${parsedBrief.summary} ${parsedBrief.what_they_do}
${crawlResult.hiringPageFound ? "Hiring process notes discovered on site." : "Standard industry technical interview process."}

INSTRUCTIONS:
1. Generate specific, insightful questions categorized as "technical", "system-design", "behavioural", or "company-fit".
2. Technical requirements (e.g. specific languages, frameworks, concurrency) MUST generate technical or system-design questions.
3. Behavioural requirements (e.g. mentorship, cross-team conflict, ownership) MUST generate behavioural questions using the STAR framework in answer_outline.
4. Every question MUST explicitly specify which requirement ID(s) it tests in "requirement_ids" (e.g. ["r1"]).
5. "difficulty" must be an integer from 1 (fundamental/accessible) to 3 (complex/system-level architectural challenge).
6. "answer_outline" must give concrete guidance on what a strong candidate covers.

Return strictly valid JSON:
[
  {
    "id": "q1",
    "requirement_ids": ["r1"],
    "category": "technical" | "behavioural" | "system-design" | "company-fit",
    "prompt": string,
    "answer_outline": string,
    "difficulty": 1 | 2 | 3
  }
]`;

  const questionRes = await llm.complete(
    [
      { role: "system", content: "You generate interview questions mapped to requirements. Output strictly valid JSON array." },
      { role: "user", content: questionPrompt },
    ],
    { responseFormatJson: true, temperature: 0.3 }
  );

  let initialQuestions: Question[] = safeParseJson<Question[]>(questionRes, []);
  if (!Array.isArray(initialQuestions)) {
    initialQuestions = [];
  }

  // Ensure question IDs and schema conformance
  initialQuestions = initialQuestions.map((q, idx) => ({
    id: q.id || `q${idx + 1}`,
    requirement_ids: Array.isArray(q.requirement_ids) && q.requirement_ids.length > 0 ? q.requirement_ids : [validatedRequirements[0]?.id || "r1"],
    category: (["technical", "behavioural", "system-design", "company-fit"].includes(q.category) ? q.category : "technical") as any,
    prompt: q.prompt || "Discuss your background and approach to this role.",
    answer_outline: q.answer_outline || "Demonstrate clear methodology, technical depth, and tangible outcomes.",
    difficulty: Math.min(3, Math.max(1, Math.round(q.difficulty || 2))),
  }));

  // -------------------------------------------------------------
  // Step 5: Deterministic Coverage Check & Second Pass Loop
  // -------------------------------------------------------------
  onProgress({
    phase: "coverage",
    message: "Executing deterministic requirement coverage check (Pass 1)...",
    progress: 75,
  });

  let passCount = 1;
  let coverageReport = evaluateCoverage(validatedRequirements, initialQuestions);

  // If there are uncovered must-have requirements, trigger Pass 2
  if (coverageReport.uncoveredMustIds.length > 0 && maxPasses > 1) {
    onProgress({
      phase: "second_pass",
      message: `Detected ${coverageReport.uncoveredMustIds.length} uncovered must-have requirements. Executing Pass 2 gap-closer...`,
      progress: 80,
    });

    passCount = 2;
    const missingReqs = validatedRequirements.filter((r) => coverageReport.uncoveredMustIds.includes(r.id));

    const gapPrompt = `You must generate targeted interview questions specifically to close coverage gaps for these mandatory requirements that were NOT covered in the previous draft:

Uncovered Mandatory Requirements:
${JSON.stringify(missingReqs, null, 2)}

INSTRUCTIONS:
1. Generate at least 1 question for EVERY listed requirement.
2. Link the exact requirement ID in "requirement_ids".
3. Category must be "technical", "system-design", "behavioural", or "company-fit".
4. Difficulty must be 1, 2, or 3.

Return strictly a JSON array of questions:
[
  {
    "id": "q_gap_1",
    "requirement_ids": ["rX"],
    "category": "technical",
    "prompt": string,
    "answer_outline": string,
    "difficulty": 2
  }
]`;

    const gapRes = await llm.complete(
      [
        { role: "system", content: "You generate gap-closing questions. Output strictly a JSON array." },
        { role: "user", content: gapPrompt },
      ],
      { responseFormatJson: true, temperature: 0.2 }
    );

    let gapQuestions: Question[] = safeParseJson<Question[]>(gapRes, []);
    if (!Array.isArray(gapQuestions)) {
      gapQuestions = [];
    }
    let nextQIndex = initialQuestions.length + 1;

    for (const gq of gapQuestions) {
      initialQuestions.push({
        id: `q${nextQIndex++}`,
        requirement_ids: Array.isArray(gq.requirement_ids) && gq.requirement_ids.length > 0 ? gq.requirement_ids : [missingReqs[0]?.id || "r1"],
        category: (["technical", "behavioural", "system-design", "company-fit"].includes(gq.category) ? gq.category : "technical") as any,
        prompt: gq.prompt,
        answer_outline: gq.answer_outline,
        difficulty: Math.min(3, Math.max(1, Math.round(gq.difficulty || 2))),
      });
    }

    // Re-evaluate coverage after second pass
    coverageReport = evaluateCoverage(validatedRequirements, initialQuestions);
  }

  const finalCoverage = buildCoverageObject(validatedRequirements, initialQuestions, passCount);

  // -------------------------------------------------------------
  // Step 6: Generate Flashcards
  // -------------------------------------------------------------
  onProgress({
    phase: "flashcards",
    message: "Generating practice flashcards for key concepts...",
    progress: 88,
  });

  const flashcardsPrompt = `Generate practice flashcards for an engineer preparing for "${parsedRole.title}".
Use the following key requirements and questions:
Requirements: ${JSON.stringify(validatedRequirements.slice(0, 6))}
Questions: ${JSON.stringify(initialQuestions.slice(0, 6).map((q) => ({ id: q.id, prompt: q.prompt })))}

INSTRUCTIONS:
1. Create between 5 and 10 high-yield flashcards.
2. "front": A concise technical concept, architectural dilemma, or behavioural prompt.
3. "back": A clear, authoritative explanation or model response outline.
4. "requirement_ids": Link to the corresponding requirement ID(s).

Return strictly valid JSON:
[
  {
    "id": "f1",
    "front": string,
    "back": string,
    "requirement_ids": ["r1"]
  }
]`;

  const flashcardRes = await llm.complete(
    [
      { role: "system", content: "You create high-impact flashcards. Output strictly valid JSON." },
      { role: "user", content: flashcardsPrompt },
    ],
    { responseFormatJson: true, temperature: 0.2 }
  );

  let flashcards: Flashcard[] = safeParseJson<Flashcard[]>(flashcardRes, []);
  if (!Array.isArray(flashcards) || flashcards.length === 0) {
    flashcards = validatedRequirements.map((r, i) => ({
      id: `f${i + 1}`,
      front: `Key Concept: ${r.text}`,
      back: `Demonstrate mastery by discussing practical architecture, edge-cases, and trade-offs related to ${r.text}.`,
      requirement_ids: [r.id],
    }));
  }

  // -------------------------------------------------------------
  // Step 7: Deterministic Arithmetic Schedule Allocation
  // -------------------------------------------------------------
  onProgress({
    phase: "schedule",
    message: "Deterministically allocating study schedule across requested days...",
    progress: 95,
  });

  const schedule = buildSchedule(input.days, initialQuestions, validatedRequirements);

  // -------------------------------------------------------------
  // Assemble & Strictly Sanitize Appendix A Kit
  // -------------------------------------------------------------
  const fullKit: Kit = {
    source: {
      company: companyName,
      company_url: input.company_url,
      role: parsedRole.title,
      location: "Remote / On-site",
      jd_chars: jdChars,
      researched_at: researchedAt,
      pages_used: pagesUsed,
    },
    company_brief: parsedBrief,
    role: {
      title: parsedRole.title,
      seniority: parsedRole.seniority || "Mid-Senior",
      responsibilities: parsedRole.responsibilities || [],
      requirements: validatedRequirements,
    },
    questions: initialQuestions,
    flashcards,
    schedule,
    coverage: finalCoverage,
  };

  onProgress({
    phase: "completed",
    message: "Interview preparation kit generated successfully!",
    progress: 100,
  });

  return sanitizeKitForAppendixA(fullKit);
}
