import { describe, it, expect } from "vitest";
import {
  reconcileCategoryQuestions,
  markQuestionEdited,
  toggleQuestionPin,
} from "../src/state/index.js";
import { Question } from "../src/types/index.js";

describe("State Reconciliation & Preservation Engine", () => {
  const initialQuestions: Question[] = [
    {
      id: "q_tech_1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Original generated tech question 1",
      answer_outline: "Original answer",
      difficulty: 2,
      origin: "generated",
      isPinned: false,
    },
    {
      id: "q_tech_2",
      requirement_ids: ["r2"],
      category: "technical",
      prompt: "User edited tech question 2",
      answer_outline: "Custom answer crafted by user",
      difficulty: 3,
      origin: "edited",
      isPinned: false,
    },
    {
      id: "q_tech_3",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Manually created user question",
      answer_outline: "Manual outline",
      difficulty: 1,
      origin: "manual",
      isPinned: true,
    },
    {
      id: "q_behav_1",
      requirement_ids: ["r3"],
      category: "behavioural",
      prompt: "Behavioural question",
      answer_outline: "STAR response",
      difficulty: 1,
      origin: "generated",
      isPinned: false,
    },
  ];

  it("should preserve edited, pinned, and manual questions when regenerating a category", () => {
    const newlyGenerated: Question[] = [
      {
        id: "new_q_1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Freshly generated tech question",
        answer_outline: "Fresh outline",
        difficulty: 2,
      },
    ];

    const reconciled = reconcileCategoryQuestions(
      initialQuestions,
      newlyGenerated,
      "technical"
    );

    // Behavioural question from another category must remain intact
    const behavQ = reconciled.find((q) => q.id === "q_behav_1");
    expect(behavQ).toBeDefined();

    // User edited question must be preserved!
    const editedQ = reconciled.find((q) => q.id === "q_tech_2");
    expect(editedQ).toBeDefined();
    expect(editedQ?.prompt).toBe("User edited tech question 2");

    // Manually added / pinned question must be preserved!
    const manualQ = reconciled.find((q) => q.id === "q_tech_3");
    expect(manualQ).toBeDefined();
    expect(manualQ?.isPinned).toBe(true);

    // Unpinned, unedited original question 1 should have been replaced
    const originalUnedited = reconciled.find((q) => q.id === "q_tech_1");
    expect(originalUnedited).toBeUndefined();

    // Fresh question should be included
    const freshQ = reconciled.find((q) => q.prompt === "Freshly generated tech question");
    expect(freshQ).toBeDefined();
    expect(freshQ?.category).toBe("technical");
  });

  it("should correctly update question state when edited or pinned", () => {
    let q: Question = {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Old prompt",
      answer_outline: "Old outline",
      difficulty: 2,
      origin: "generated",
      isPinned: false,
    };

    q = markQuestionEdited(q, { prompt: "New improved prompt" });
    expect(q.prompt).toBe("New improved prompt");
    expect(q.origin).toBe("edited");

    q = toggleQuestionPin(q);
    expect(q.isPinned).toBe(true);

    q = toggleQuestionPin(q);
    expect(q.isPinned).toBe(false);
  });
});
