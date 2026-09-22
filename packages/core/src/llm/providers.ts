import { LLMClientOptions, LLMMessage, LLMProvider, cleanJsonOutput } from "./client.js";
export type { LLMProvider, LLMClientOptions, LLMMessage };


/**
 * Robust retry wrapper with exponential backoff & jitter for rate-limiting (HTTP 429 / 503).
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 5,
  initialDelayMs: number = 2000
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isRateLimit =
        err.status === 429 ||
        (err.message && err.message.includes("429")) ||
        (err.message && err.message.includes("quota")) ||
        (err.message && err.message.includes("rate_limit"));
      const isServerErr = err.status >= 500;

      if ((isRateLimit || isServerErr) && attempt <= retries) {
        let waitTime = delay + Math.random() * 1000;

        // Check if provider explicitly suggested wait duration: "Please try again in 13.8s"
        const match = err.message?.match(/try again in ([\d\.]+)s/i);
        if (match && match[1]) {
          const waitSeconds = parseFloat(match[1]);
          waitTime = Math.max(waitTime, Math.ceil(waitSeconds * 1000) + 1000);
        }

        console.warn(
          `[LLM Rate-Limit / Retry] Attempt ${attempt}/${retries}. Waiting ${(waitTime / 1000).toFixed(1)}s before retry...`
        );
        await new Promise((res) => setTimeout(res, waitTime));
        delay = Math.min(delay * 2, 20000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded for LLM request");
}

/**
 * Google Gemini Provider (Free Tier compatible: gemini-1.5-flash)
 */
export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(messages: LLMMessage[], options?: LLMClientOptions): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Format messages for Gemini API
    const systemInstruction = messages.find((m) => m.role === "system");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

    const body: any = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    if (options?.responseFormatJson) {
      body.generationConfig.responseMimeType = "application/json";
    }

    return callWithRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err: any = new Error(`Gemini API error (${res.status}): ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return cleanJsonOutput(text);
    });
  }
}

/**
 * Groq Provider (Fast Llama-3.3-70b / Llama-3.1-8b free tier)
 */
export class GroqProvider implements LLMProvider {
  name = "groq";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = process.env.GROQ_MODEL || "openai/gpt-oss-20b") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(messages: LLMMessage[], options?: LLMClientOptions): Promise<string> {
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const body: any = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.responseFormatJson) {
      body.response_format = { type: "json_object" };
    }

    return callWithRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err: any = new Error(`Groq API error (${res.status}): ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      return cleanJsonOutput(text);
    });
  }
}

/**
 * Deterministic Mock Provider for zero-dependency offline runs and evaluation testing.
 * Automatically synthesizes realistic JSON matching expected schema based on JD content.
 */
export class MockProvider implements LLMProvider {
  name = "mock";

  async complete(messages: LLMMessage[], _options?: LLMClientOptions): Promise<string> {
    const userMsg = messages.find((m) => m.role === "user")?.content || "";
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";

    // Coverage 2nd pass gap questions
    if (userMsg.includes("coverage gaps") || userMsg.includes("uncovered")) {
      return this.mockGapQuestions(userMsg);
    }

    // Flashcards response
    if (systemMsg.includes("flashcard") || userMsg.includes("flashcards")) {
      return this.mockFlashcards(userMsg);
    }

    // Question generation response
    if (userMsg.includes("interview question bank") || userMsg.includes("question bank") || (systemMsg.includes("questions") && !userMsg.includes("Extract the role title"))) {
      return this.mockQuestions(userMsg);
    }

    // Company brief response
    if (systemMsg.includes("brief") || userMsg.includes("company brief") || userMsg.includes("Company Brief")) {
      return this.mockBrief(userMsg);
    }

    // Requirement extraction response
    if (userMsg.includes("Extract the role title") || userMsg.includes("technical recruiter")) {
      return this.mockRequirements(userMsg);
    }

    // Mock interview evaluation response
    if (systemMsg.includes("evaluating candidates") || userMsg.includes("EVALUATE THE ANSWER")) {
      return JSON.stringify({
        overallScore: 8,
        criteriaScores: {
          technicalAccuracy: 8,
          structureAndClarity: 8,
          starFramework: 7,
        },
        strengths: [
          "Directly identified the core distributed concurrency challenges",
          "Sound architectural reasoning regarding idempotency and failure recovery",
        ],
        weakSpots: [
          "Could elaborate more on partition tolerance and edge-case deadlock scenarios",
          "Recommend mentioning concrete SLOs and distributed tracing correlation IDs",
        ],
        recommendedImprovements: "Structure your explanation using a clear 3-tier architectural flow: Ingestion, Concurrency Control, and Eventual Consistency.",
      });
    }

    // Default mock JSON
    return JSON.stringify({ message: "Mock LLM completion executed successfully." });
  }

  private mockRequirements(prompt: string): string {
    const isSenior = prompt.toLowerCase().includes("senior") || prompt.toLowerCase().includes("lead");
    const isThin = prompt.length < 250;

    if (isThin) {
      return JSON.stringify({
        title: "Software Engineer",
        seniority: "Mid",
        responsibilities: [
          "Design and build software features according to specifications",
          "Collaborate with team members to deliver clean code",
        ],
        requirements: [
          {
            id: "r1",
            text: "Demonstrated software development experience",
            kind: "technical",
            priority: "must",
          },
          {
            id: "r2",
            text: "Strong problem solving and communication skills",
            kind: "behavioural",
            priority: "must",
          },
        ],
      });
    }

    return JSON.stringify({
      title: isSenior ? "Senior Full-Stack Engineer" : "Full-Stack Software Engineer",
      seniority: isSenior ? "Senior" : "Mid",
      responsibilities: [
        "Architect and implement scalable distributed web services",
        "Lead technical design discussions and collaborate cross-functionally",
        "Maintain high test coverage and engineering standards across the stack",
      ],
      requirements: [
        {
          id: "r1",
          text: "Strong proficiency in TypeScript, Node.js, and modern frontend frameworks (React/Next.js)",
          kind: "technical",
          priority: "must",
        },
        {
          id: "r2",
          text: "Experience designing RESTful APIs, microservices, and database schemas",
          kind: "technical",
          priority: "must",
        },
        {
          id: "r3",
          text: "Mentorship of junior and mid-level engineers, fostering engineering excellence",
          kind: "behavioural",
          priority: "must",
        },
        {
          id: "r4",
          text: "Background in distributed cloud infrastructure, CI/CD, and observability",
          kind: "domain",
          priority: "nice",
        },
      ],
    });
  }

  private mockBrief(_prompt: string): string {
    return JSON.stringify({
      summary: "Technology company engineering high-performance software platforms and developer tooling.",
      what_they_do: "Develops modular web and cloud infrastructure products designed to streamline modern engineering workflows and enterprise data pipelines.",
      sources: ["https://company-brief.internal"],
    });
  }

  private mockQuestions(_prompt: string): string {
    return JSON.stringify([
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "How do you handle state synchronization and asynchronous side effects in large-scale React/Next.js applications?",
        answer_outline: "Discuss server components vs client components, query caching (TanStack Query/SWR), optimistic updates, and clean boundary separation.",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "system-design",
        prompt: "Design a high-throughput job queue system capable of handling bursty background evaluation tasks with retry mechanisms.",
        answer_outline: "Outline message broker selection (Redis Streams/Kafka), idempotency keys, dead letter queues, and consumer auto-scaling.",
        difficulty: 3,
      },
      {
        id: "q3",
        requirement_ids: ["r3"],
        category: "behavioural",
        prompt: "Tell me about a time you had to guide an engineer through a complex architectural refactor without stalling product delivery.",
        answer_outline: "Use STAR method: explain the legacy bottleneck, incremental strangler pattern strategy, pair programming, and post-launch metric gains.",
        difficulty: 2,
      },
      {
        id: "q4",
        requirement_ids: ["r4"],
        category: "technical",
        prompt: "What observability strategies do you implement to identify latency bottlenecks across distributed microservices?",
        answer_outline: "Explain distributed tracing (OpenTelemetry), APM metrics, structured correlation IDs, and SLO alerting thresholds.",
        difficulty: 2,
      },
      {
        id: "q5",
        category: "company-fit",
        requirement_ids: ["r1"],
        prompt: "Why are you interested in our engineering culture, and how does our product roadmap align with your career goals?",
        answer_outline: "Reference technical agility, ownership mentality, and alignment with building robust developer-centric tooling.",
        difficulty: 1,
      },
    ]);
  }

  private mockGapQuestions(_prompt: string): string {
    return JSON.stringify([
      {
        id: "q_gap_1",
        requirement_ids: ["r2"],
        category: "technical",
        prompt: "Explain how you ensure database consistency and index optimization under heavy concurrent write loads.",
        answer_outline: "Discuss transaction isolation levels, partial indexing, read replicas, and sharding strategies.",
        difficulty: 2,
      },
    ]);
  }

  private mockFlashcards(_prompt: string): string {
    return JSON.stringify([
      {
        id: "f1",
        front: "What is the primary benefit of React Server Components (RSC) in Next.js?",
        back: "Zero-bundle-size server execution, direct backend database access without client roundtrips, and improved initial page load performance.",
        requirement_ids: ["r1"],
      },
      {
        id: "f2",
        front: "What constitutes a resilient retry strategy in distributed systems?",
        back: "Exponential backoff with randomized jitter, maximum retry limits, and dead-letter queues to prevent thundering herd problems.",
        requirement_ids: ["r2"],
      },
      {
        id: "f3",
        front: "What is the STAR framework for behavioural interview responses?",
        back: "Situation (context), Task (goal/challenge), Action (specific steps taken), Result (measurable impact and lessons learned).",
        requirement_ids: ["r3"],
      },
    ]);
  }
}

/**
 * Creates the appropriate LLM provider based on environment variables.
 */
export function createLLMProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase().trim();

  // 1. Google Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if ((provider === "gemini" || !provider) && geminiKey) {
    return new GeminiProvider(geminiKey);
  }

  // 2. Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (provider === "groq" && groqKey) {
    return new GroqProvider(groqKey);
  }

  // 3. Fallback checks
  if (geminiKey) return new GeminiProvider(geminiKey);
  if (groqKey) return new GroqProvider(groqKey);

  // Default to offline deterministic mock provider
  console.info("[LLM Provider] No API key detected. Initializing robust offline deterministic MockProvider.");
  return new MockProvider();
}
