import { describe, it, expect } from "vitest";
import {
  KitSchema,
  BatchInputSchema,
  BatchOutputSchema,
  sanitizeKitForAppendixA,
} from "../src/types/index.js";

describe("Appendix A & B Schema Compliance", () => {
  it("should validate a complete Appendix A kit correctly", () => {
    const validKit = {
      source: {
        company: "Acme Corp",
        company_url: "https://acme.com",
        role: "Senior Backend Engineer",
        location: "Remote",
        jd_chars: 1200,
        researched_at: "2026-09-01T10:00:00Z",
        pages_used: ["https://acme.com", "https://acme.com/jobs"],
      },
      company_brief: {
        summary: "Acme builds scalable cloud logistics software.",
        what_they_do: "Enterprise logistics optimization and real-time fleet tracking.",
        sources: ["https://acme.com"],
      },
      role: {
        title: "Senior Backend Engineer",
        seniority: "Senior",
        responsibilities: ["Build fault-tolerant microservices"],
        requirements: [
          {
            id: "r1",
            text: "5+ years with React",
            kind: "technical",
            priority: "must",
          },
        ],
      },
      questions: [
        {
          id: "q1",
          requirement_ids: ["r1"],
          category: "technical",
          prompt: "Explain the React reconciliation algorithm.",
          answer_outline: "Fiber architecture, work loops, prioritization.",
          difficulty: 2,
        },
      ],
      flashcards: [
        {
          id: "f1",
          front: "What is Fiber?",
          back: "React's reimplementation of the core reconciliation engine.",
          requirement_ids: ["r1"],
        },
      ],
      schedule: {
        days_available: 5,
        days: [
          {
            day: 1,
            focus: "React Deep Dive",
            question_ids: ["q1"],
            minutes: 60,
          },
        ],
      },
      coverage: {
        uncovered_requirement_ids: [],
        passes: 2,
      },
    };

    const parsed = KitSchema.safeParse(validKit);
    expect(parsed.success).toBe(true);

    const sanitized = sanitizeKitForAppendixA(validKit as any);
    expect(sanitized.schedule.days[0].minutes).toBe(60);
    expect(Number.isInteger(sanitized.schedule.days[0].minutes)).toBe(true);
  });

  it("should fail validation if difficulty is out of range or minutes is not integer", () => {
    const invalidDifficulty = {
      source: {
        company: "Test",
        company_url: "https://test.com",
        role: "Dev",
        location: "Remote",
        jd_chars: 500,
        researched_at: "2026-09-01T10:00:00Z",
        pages_used: [],
      },
      company_brief: { summary: "S", what_they_do: "W", sources: [] },
      role: { title: "Dev", seniority: "Mid", responsibilities: [], requirements: [] },
      questions: [
        {
          id: "q1",
          requirement_ids: [],
          category: "technical",
          prompt: "P",
          answer_outline: "A",
          difficulty: 5, // INVALID: must be 1 to 3
        },
      ],
      flashcards: [],
      schedule: {
        days_available: 1,
        days: [{ day: 1, focus: "F", question_ids: [], minutes: 45.5 }], // INVALID: float
      },
      coverage: { uncovered_requirement_ids: [], passes: 1 },
    };

    const result = KitSchema.safeParse(invalidDifficulty);
    expect(result.success).toBe(false);
  });

  it("should validate Appendix B input and output shapes", () => {
    const batchInput = [
      {
        id: "case-01",
        jd: "Senior Backend Engineer\n\nWe are looking for ...",
        company_url: "http://localhost:8099/acme/",
        days: 5,
      },
    ];
    expect(BatchInputSchema.safeParse(batchInput).success).toBe(true);

    const batchOutput = {
      version: "1.0",
      generated_at: "2026-09-01T09:12:44Z",
      kits: [
        {
          id: "case-01",
          status: "failed",
          kit: null,
          error: {
            code: "COMPANY_UNREACHABLE",
            message: "Company site unreachable after 3 retries.",
          },
        },
      ],
    };
    expect(BatchOutputSchema.safeParse(batchOutput).success).toBe(true);
  });
});
