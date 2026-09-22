import { Coverage, Question, Requirement } from "../types/index.js";

export interface CoverageReport {
  uncoveredMustIds: string[];
  uncoveredNiceIds: string[];
  allUncoveredIds: string[];
  coveredReqIds: string[];
  coverageRatio: number;
}

/**
 * Deterministically analyzes which requirements are covered by the current questions.
 */
export function evaluateCoverage(
  requirements: Requirement[],
  questions: Question[]
): CoverageReport {
  const coveredSet = new Set<string>();

  for (const q of questions) {
    if (Array.isArray(q.requirement_ids)) {
      for (const reqId of q.requirement_ids) {
        coveredSet.add(reqId);
      }
    }
  }

  const uncoveredMustIds: string[] = [];
  const uncoveredNiceIds: string[] = [];
  const allUncoveredIds: string[] = [];

  for (const r of requirements) {
    if (!coveredSet.has(r.id)) {
      allUncoveredIds.push(r.id);
      if (r.priority === "must") {
        uncoveredMustIds.push(r.id);
      } else {
        uncoveredNiceIds.push(r.id);
      }
    }
  }

  const coverageRatio = requirements.length > 0
    ? (requirements.length - allUncoveredIds.length) / requirements.length
    : 1.0;

  return {
    uncoveredMustIds,
    uncoveredNiceIds,
    allUncoveredIds,
    coveredReqIds: Array.from(coveredSet),
    coverageRatio,
  };
}

/**
 * Creates the official Appendix A Coverage object.
 */
export function buildCoverageObject(
  requirements: Requirement[],
  questions: Question[],
  passes: number
): Coverage {
  const report = evaluateCoverage(requirements, questions);
  return {
    uncovered_requirement_ids: report.allUncoveredIds,
    passes: Math.max(1, passes),
  };
}
