# PrepKit AI — The AI Interview Prep Kit
**Full-Stack Engineering Assessment | Trao Technologies (`FS-AI-INTERVIEW-01`)**

PrepKit AI transforms any job description, company website URL, and preparation timeframe into a personalized, rigorous interview preparation kit. It crawls the company's website to discover what they do and how they hire, synthesizes a company brief, extracts non-fabricated role requirements, generates categorized interview questions, deterministically checks coverage across multiple passes, allocates an arithmetic day-by-day study roadmap, provides 3D interactive flashcards with spaced repetition, and features an **Interactive AI Mock Interviewer & Weak-Spot Diagnostic engine**.

---

## Table of Contents
1. [Project Overview & Tech Stack Justification](#1-project-overview--tech-stack-justification)
2. [Setup Instructions (Local & Deployed)](#2-setup-instructions-local--deployed)
3. [Section 9 Batch Entry Point Execution](#3-section-9-batch-entry-point-execution)
4. [LLM Providers & Free-Tier Resilience](#4-llm-providers--free-tier-resilience)
5. [High-Level Architecture](#5-high-level-architecture)
6. [Web Crawler & Information Retrieval Strategy](#6-web-crawler--information-retrieval-strategy)
7. [Research & Generation Pipeline Sequencing](#7-research--generation-pipeline-sequencing)
8. [The Builder: State Representation (Generated, Edited, Pinned)](#8-the-builder-state-representation-generated-edited-pinned)
9. [Deterministic Schedule Allocation Arithmetic](#9-deterministic-schedule-allocation-arithmetic)
10. [Creative Feature: AI Mock Interviewer & Readiness Diagnostics](#10-creative-feature-ai-mock-interviewer--readiness-diagnostics)
11. [Key Design Decisions, Trade-offs & Known Limitations](#11-key-design-decisions-trade-offs--known-limitations)
12. [Automated Verification & Test Suite](#12-automated-verification--test-suite)

---

## 1. Project Overview & Tech Stack Justification

The solution is implemented as a high-performance TypeScript monorepo structured into three isolated domains:

| Layer | Technology | Justification |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS + Lucide Icons | Server components, fast client hydration, responsive dark-mode glassmorphism design, zero-delay optimistic updates, keyboard accessibility. |
| **Backend** | Node.js + Express + Mongoose + TypeScript | Clear separation of concerns, streaming Server-Sent Events (SSE) for real-time generation progress, resilient error handling. |
| **Database** | MongoDB (Mongoose) with In-Memory Repository Fallback | When `MONGODB_URI` is provided (e.g. MongoDB Atlas), connects to MongoDB. When unset or offline, seamlessly routes to a resilient in-memory repository with zero installation hurdles. |
| **Crawler** | Cheerio + Native Fetch + Custom Robots/Link Ranker | Lightweight, handles relative links and local test addresses (`http://localhost:...`), respects `robots.txt`, SSRF safety guards, link scoring heuristics. |
| **Core Domain** | `@prepkit/core` (Zod + Vitest) | Shared deterministic algorithms: Appendix A/B validation, pure arithmetic scheduler, multi-pass coverage checker, and state reconciliation engine. |

---

## 2. Setup Instructions (Local & Deployed)

### Prerequisites
- Node.js >= 18 (Tested on v20 and v26)
- npm >= 9

### Local Setup
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd trao_assignment
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** (Optional):
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *Note: PrepKit AI comes equipped with a deterministic offline mock provider and automatic database fallback. You can run and evaluate the application immediately even without external API keys or a local MongoDB server!*

4. **Build Core & Packages**:
   ```bash
   npm run build:core
   ```

5. **Start Development Servers**:
   ```bash
   npm run dev
   ```
   - Frontend UI: `http://localhost:3000`
   - Backend API: `http://localhost:4000`

---

## 3. Section 9 Batch Entry Point Execution

The repository implements the exact batch CLI entry point specified in Section 9 of the brief:

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

### Example Run:
```bash
npm run evaluate -- --input test-cases.json --output test-output.json
```

### Conformance Guarantees:
- **Same Core Codepath**: Invokes `generateInterviewKit()` from `@prepkit/core`, the identical pipeline used by the web interface.
- **Local Host Support**: Successfully crawls sites served on `http://localhost:...` and follows relative links.
- **Resilient Batch Processing**: Never halts on a single case failure; records individual failed entries in the shape of Appendix B and proceeds to complete remaining cases.
- **Strict Appendix A & B Conformance**: Validated against Zod schemas matching exact fields, difficulty (1-3), integer minutes, and stable IDs.

---

## 4. LLM Providers & Free-Tier Resilience

PrepKit AI supports multiple LLM providers:
1. **Google Gemini API** (`gemini-1.5-flash` / `gemini-2.5-flash`): Free tier (15 RPM / 1M TPM).
2. **Groq API** (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`): Free tier (30 RPM).
3. **Deterministic Offline Mock Provider**: Used in automated test suites and when no API key is set, ensuring reliable zero-downtime execution.

### Free-Tier Rate-Limit Protection:
- **Exponential Backoff with Jitter**: Automatically catches HTTP 429 and 503 errors and retries up to 4 times with randomized jitter (`delay * 2 + jitter`).
- **Prompt Token Optimization**: Web crawler extracts and cleans only high-signal content, truncating boilerplate to stay well under token-per-minute (TPM) limits.
- **Defensive JSON Sanitization**: `cleanJsonOutput()` strips markdown backticks and heals malformed brackets to avoid re-triggering calls due to syntax formatting.

---

## 5. High-Level Architecture

```
trao_assignment/
├── package.json                 # Monorepo scripts: evaluate, test, dev, build
├── test-cases.json              # Sample evaluation input cases
├── scripts/
│   └── evaluate.ts              # Section 9 CLI Batch Runner (Appendix B)
├── packages/
│   └── core/                    # Pure domain logic, types, scheduler, crawler
│       ├── src/
│       │   ├── types/           # Appendix A & B schemas (Zod)
│       │   ├── crawler/         # Robots.txt parser, link ranker, page cleaner
│       │   ├── scheduler/       # Pure arithmetic day allocator
│       │   ├── coverage/        # Deterministic coverage gap checker
│       │   ├── state/           # Generated vs Edited vs Pinned reconciler
│       │   ├── llm/             # Gemini, Groq, and Mock adapters with backoff
│       │   └── pipeline/        # Multi-step generation workflow + 2nd pass loop
│       └── tests/               # 15 unit tests (Vitest)
└── apps/
    ├── backend/                 # Express + Mongoose API server
    │   └── src/
    │       ├── controllers/     # Auth, Kits, SSE Streaming, Mock Interview
    │       ├── models/          # Kit & User models with in-memory fallback
    │       └── server.ts
    └── frontend/                # Next.js 14 + Tailwind CSS web application
        └── src/
            ├── app/             # App Router: Dashboard (/), Kit (/kit/[id]), Login (/login)
            ├── components/      # Builder, Schedule, Practice, MockInterview, Export
            └── lib/             # API client, state management
```

---

## 6. Web Crawler & Information Retrieval Strategy

Companies structure hiring information idiosyncratically: some publish handbooks (GitLab), some maintain public engineering culture pages (PostHog), while others bury links in footers. A fixed path list is insufficient.

### Crawler Heuristics:
1. **Robots.txt Respect**: Fetches `/robots.txt` at origin, parses directives, and filters out disallowed paths.
2. **Dynamic Link Discovery & Relative URL Resolution**: Resolves relative `href` attributes against the target host without assuming external domain boundaries.
3. **Keyword-Weighted Link Scoring**:
   - `interview`: +100
   - `hiring`: +95
   - `careers` / `jobs`: +90
   - `handbook`: +80
   - `engineering-culture` / `values`: +65–75
   - Penalties applied to legal, terms, cart, or login URLs (`-100`).
4. **Content Sanitization**: Uses Cheerio to strip `<script>`, `<style>`, `<nav>`, `<footer>`, forms, and trackers, leaving semantic text capped at 8,000 characters.
5. **SSRF Protection**: In production mode, rejects loopback and private IP ranges. In evaluation mode (`ALLOW_LOCAL_URLS=true`), permits `http://localhost:...`.
6. **Honest Reporting**: Unreachable pages or missing hiring information are recorded as informative notes in `company_brief` rather than terminating the run.

---

## 7. Research & Generation Pipeline Sequencing

Rather than a single prompt that hallucinate everything at once, generation is divided into deliberate, sequential steps:

1. **Step 1: Crawler & Site Discovery**: Fetches company homepage and high-ranking candidate pages.
2. **Step 2: Requirement Extraction**: Takes pasted JD. Extracts `title`, `seniority`, `responsibilities`, and `requirements` (`priority: "must" | "nice"`, `kind: "technical" | "behavioural" | "domain"`).
   *Rule: Never invent requirements. A 2-line description generates an honest, concise set of requirements.*
3. **Step 3: Company Brief Synthesis**: Generates `summary`, `what_they_do`, and records `sources`.
4. **Step 4: Targeted Question Generation by Category**: Prompts tailored separately:
   - `technical` & `system-design`: Target specific frameworks, concurrency, and architecture requirements.
   - `behavioural`: Target mentorship, leadership, and cross-team collaboration using the STAR methodology.
   - `company-fit`: Target company culture, product mission, and industry context.
   - Every question assigns `requirement_ids: ["rX"]` and `difficulty: 1 | 2 | 3`.
5. **Step 5: Deterministic Coverage Check (Second Pass Loop)**:
   - Deterministic TypeScript code compares `questions.flatMap(q => q.requirement_ids)` against `requirements`.
   - If any must-have requirement has 0 questions, initiates **Second Pass**:
     - Sends only the uncovered requirements to a gap-closer prompt.
     - Merges new questions and re-evaluates coverage.
     - Sets `coverage: { uncovered_requirement_ids, passes: 2 }`.
6. **Step 6: High-Yield Flashcard Generation**: Generates front/back concept cards mapped to requirement IDs.
7. **Step 7: Deterministic Arithmetic Schedule Allocation**: Code-level distribution across requested days.

---

## 8. The Builder: State Representation (Generated, Edited, Pinned)

### The Problem:
A prep kit arrives as a draft. Users customize questions, edit outlines, reorder items, and move questions between categories. If a user clicks **"Regenerate Category"**, their hard work must not be discarded or clobbered.

### The Solution (`packages/core/src/state/index.ts`):
Each question maintains state metadata:
```typescript
interface Question {
  id: string;
  requirement_ids: string[];
  category: "technical" | "behavioural" | "system-design" | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  origin?: "generated" | "edited" | "manual";
  isPinned?: boolean;
}
```

- **Inline Editing**: Modifying text switches `origin` to `"edited"`.
- **Manual Creation**: Adding a question sets `origin: "manual"` and `isPinned: true`.
- **Pinning**: Users can toggle `📌 Pinned` on any question.
- **Reconciliation Engine**:
  ```typescript
  // Questions from other categories are strictly untouched
  // In the target category:
  // - Retain all items where isPinned === true OR origin === "edited" OR origin === "manual"
  // - Discard only unedited, unpinned "generated" items
  // - Append fresh AI questions with conflict-free stable IDs
  ```
- **Result**: User work is completely preserved during regenerations.

---

## 9. Deterministic Schedule Allocation Arithmetic

Allocating topics across available days is pure arithmetic, not handed to an LLM:

1. **Exact Day Count**: Guarantees exactly `days_available` day slots (whether 1 day or 60 days).
2. **Front-Loading Hard & Must-Have Material**:
   - Questions are scored: `must` requirements (+1000), `difficulty: 3` (+300), `difficulty: 2` (+200), `difficulty: 1` (+100), `system-design` (+50), `technical` (+40).
   - Sorted descending: High-difficulty must-have questions land in Day 1 and early days.
   - Final days are reserved for behavioral scenarios, company values, and rapid review drills.
3. **1-Day Cram Edge Case**: Allocates all must-have questions with an integrated cram schedule (e.g. 75-120 integer minutes).
4. **Integer Durations**: Durations are strictly integer minutes (e.g. 30, 45, 60, 90 mins).
5. **Referential Integrity**: Every ID in `schedule.days[i].question_ids` is guaranteed to exist in `questions`.

---

## 10. Creative Feature: AI Mock Interviewer & Readiness Diagnostics

To elevate the prep kit beyond static reading, PrepKit AI includes an **Interactive AI Mock Interview Simulator**:

### How It Works:
1. The candidate chooses any question from the kit or accepts a challenge.
2. The candidate writes or speaks their answer (with simulated audio dictation / sample responses).
3. The AI acts as a **Principal Engineer & Bar-Raiser**, comparing the answer against the kit's benchmark `answer_outline`.
4. **Actionable Feedback Report**:
   - **Overall Score** (1-10)
   - **Criteria Scores**: Technical Depth, Structure & Clarity, and STAR Framework alignment.
   - **Identified Strengths**: What the candidate articulated effectively.
   - **Weak Spots & Blind Spots**: Specific edge cases, missing failure modes, or lack of operational metrics.
   - **Recommended Improvements**: Clear advice on how to structure the response next time.
   - All attempts are saved to the kit's history for longitudinal tracking.

### Bonus Creative Tool:
- **Printable Cheat-Sheet & Appendix A Export**: One-click print-optimized view for offline interview-day review and raw JSON download.

---

## 11. Key Design Decisions, Trade-offs & Known Limitations

| Decision | Trade-off / Justification |
|---|---|
| **Dual Database Strategy (MongoDB + In-Memory Fallback)** | Guarantees that evaluators can run the project on any machine without installing MongoDB or setting up cloud accounts, while maintaining 100% Mongoose/MongoDB support when `MONGODB_URI` is provided. |
| **Max 4 Crawled Pages Limit** | Prevents latency spikes and protects free-tier token budgets while retrieving the homepage and top 3 ranked hiring/culture links. |
| **Two-Pass Coverage Cap** | A 2-pass loop reliably closes must-have gaps while preventing infinite loops or excessive API calls. |
| **Known Limitation: JavaScript-heavy SPAs** | Cheerio parses static HTML; websites that render 100% of their content via client-side JavaScript without SSR may yield minimal text. In those cases, the crawler reports minimal content honestly and falls back gracefully to job description synthesis. |

---

## 12. Automated Verification & Test Suite

Run the automated test suite covering all critical deterministic behaviors:

```bash
npm test
```

### Test Coverage (`15 passed tests`):
- `tests/scheduler.test.ts`: 1-day cram, 5-day distribution, 60-day allocation, integer minutes, and front-loading of difficulty-3 must-haves.
- `tests/coverage.test.ts`: Deterministic gap detection and coverage ratio calculations.
- `tests/state.test.ts`: Preservation of pinned, edited, and manually added items during category regeneration.
- `tests/schema.test.ts`: Strict validation of Appendix A and Appendix B schemas using Zod.
- `tests/crawler.test.ts`: Link scoring heuristics, `robots.txt` compliance, HTML cleaning, and SSRF address validation.

---

*Authored for the Trao Technologies Full-Stack Engineering Assessment.*
