import { describe, it, expect } from "vitest";
import { buildSchedule } from "../src/scheduler/index.js";
import { Question, Requirement } from "../src/types/index.js";

describe("Deterministic Schedule Allocator", () => {
  const mockRequirements: Requirement[] = [
    { id: "r1", text: "5+ years React", kind: "technical", priority: "must" },
    { id: "r2", text: "Distributed Systems", kind: "technical", priority: "must" },
    { id: "r3", text: "Mentorship", kind: "behavioural", priority: "nice" },
  ];

  const mockQuestions: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "React concurrency",
      answer_outline: "Fiber, concurrent features",
      difficulty: 2,
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "system-design",
      prompt: "Distributed consensus",
      answer_outline: "Raft, Paxos, leader election",
      difficulty: 3,
    },
    {
      id: "q3",
      requirement_ids: ["r3"],
      category: "behavioural",
      prompt: "Mentoring junior engineers",
      answer_outline: "Pair programming, feedback",
      difficulty: 1,
    },
  ];

  it("should create a schedule with exactly 1 day when 1 day is requested", () => {
    const schedule = buildSchedule(1, mockQuestions, mockRequirements);
    expect(schedule.days_available).toBe(1);
    expect(schedule.days.length).toBe(1);
    expect(schedule.days[0].day).toBe(1);
    expect(schedule.days[0].minutes).toBeGreaterThan(0);
    expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
    // All must-have questions must appear
    expect(schedule.days[0].question_ids).toContain("q1");
    expect(schedule.days[0].question_ids).toContain("q2");
  });

  it("should create a schedule with exactly 5 days when 5 days are requested", () => {
    const schedule = buildSchedule(5, mockQuestions, mockRequirements);
    expect(schedule.days_available).toBe(5);
    expect(schedule.days.length).toBe(5);

    // Verify all days have integer minutes and valid day indices
    for (let i = 0; i < 5; i++) {
      expect(schedule.days[i].day).toBe(i + 1);
      expect(Number.isInteger(schedule.days[i].minutes)).toBe(true);
      expect(schedule.days[i].minutes).toBeGreaterThan(0);
    }

    // Check that every question_id in schedule actually exists in mockQuestions
    const validQIds = new Set(mockQuestions.map((q) => q.id));
    for (const day of schedule.days) {
      for (const qId of day.question_ids) {
        expect(validQIds.has(qId)).toBe(true);
      }
    }
  });

  it("should front-load harder and must-have questions in earlier days", () => {
    const schedule = buildSchedule(5, mockQuestions, mockRequirements);
    // q2 is difficulty: 3 and must-have -> should appear on day 1 or 2
    const dayOfQ2 = schedule.days.findIndex((d) => d.question_ids.includes("q2")) + 1;
    expect(dayOfQ2).toBeLessThanOrEqual(2);
  });

  it("should handle large day requests (e.g. 60 days) cleanly with exact day count", () => {
    const schedule = buildSchedule(60, mockQuestions, mockRequirements);
    expect(schedule.days_available).toBe(60);
    expect(schedule.days.length).toBe(60);
    expect(schedule.days[59].day).toBe(60);
    expect(Number.isInteger(schedule.days[59].minutes)).toBe(true);
  });
});
