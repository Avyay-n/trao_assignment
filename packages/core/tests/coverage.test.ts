import { describe, it, expect } from "vitest";
import { evaluateCoverage, buildCoverageObject } from "../src/coverage/index.js";
import { Question, Requirement } from "../src/types/index.js";

describe("Deterministic Coverage Checker", () => {
  const requirements: Requirement[] = [
    { id: "r1", text: "React 18", kind: "technical", priority: "must" },
    { id: "r2", text: "PostgreSQL", kind: "technical", priority: "must" },
    { id: "r3", text: "Docker", kind: "domain", priority: "nice" },
  ];

  it("should accurately detect covered and uncovered requirements", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "React test",
        answer_outline: "test outline",
        difficulty: 2,
      },
    ];

    const report = evaluateCoverage(requirements, questions);
    expect(report.coveredReqIds).toContain("r1");
    expect(report.uncoveredMustIds).toEqual(["r2"]);
    expect(report.uncoveredNiceIds).toEqual(["r3"]);
    expect(report.allUncoveredIds).toEqual(["r2", "r3"]);
    expect(report.coverageRatio).toBeCloseTo(1 / 3, 2);
  });

  it("should report 100% coverage when all requirements have questions", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1", "r2"],
        category: "technical",
        prompt: "Full-stack integration",
        answer_outline: "test outline",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r3"],
        category: "domain",
        prompt: "Containerization",
        answer_outline: "Docker compose, multi-stage builds",
        difficulty: 1,
      },
    ];

    const report = evaluateCoverage(requirements, questions);
    expect(report.uncoveredMustIds).toHaveLength(0);
    expect(report.allUncoveredIds).toHaveLength(0);
    expect(report.coverageRatio).toBe(1.0);

    const coverageObj = buildCoverageObject(requirements, questions, 2);
    expect(coverageObj.uncovered_requirement_ids).toHaveLength(0);
    expect(coverageObj.passes).toBe(2);
  });
});
