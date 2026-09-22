import { Question, QuestionCategory } from "../types/index.js";

/**
 * State reconciliation algorithm for the Builder.
 *
 * Ensures questions that were manually added, edited, or pinned are strictly preserved
 * when a user clicks "Regenerate" on a specific category.
 */
export function reconcileCategoryQuestions(
  existingQuestions: Question[],
  newlyGeneratedQuestions: Question[],
  categoryToRegenerate: QuestionCategory
): Question[] {
  // 1. Separate questions from other categories (which must never be modified)
  const otherCategoryQuestions = existingQuestions.filter(
    (q) => q.category !== categoryToRegenerate
  );

  // 2. Identify existing questions in this category that MUST be preserved:
  // - Explicitly pinned by user (isPinned === true)
  // - Edited inline by user (origin === "edited")
  // - Added manually by user (origin === "manual")
  const currentCategoryQuestions = existingQuestions.filter(
    (q) => q.category === categoryToRegenerate
  );

  const preservedQuestions: Question[] = [];
  const existingIds = new Set<string>(existingQuestions.map((q) => q.id));

  for (const q of currentCategoryQuestions) {
    const isUserModified = q.isPinned || q.origin === "edited" || q.origin === "manual";
    if (isUserModified) {
      preservedQuestions.push({ ...q });
    }
  }

  // 3. Prepare newly generated questions, ensuring stable and non-colliding IDs
  const freshQuestions: Question[] = [];
  let counter = 1;

  for (const newQ of newlyGeneratedQuestions) {
    let candidateId = newQ.id;
    while (existingIds.has(candidateId) && !preservedQuestions.some((p) => p.id === candidateId)) {
      candidateId = `q_${categoryToRegenerate.slice(0, 4)}_${Date.now().toString(36)}_${counter++}`;
    }
    existingIds.add(candidateId);

    freshQuestions.push({
      ...newQ,
      id: candidateId,
      category: categoryToRegenerate,
      origin: "generated",
      isPinned: false,
    });
  }

  // 4. Combine: Preserved user questions take precedence and appear first or inline,
  // followed by the fresh AI questions.
  const mergedCategoryQuestions = [...preservedQuestions, ...freshQuestions];

  // 5. Reassemble full kit questions list
  return [...otherCategoryQuestions, ...mergedCategoryQuestions];
}

/**
 * Marks a question as edited.
 */
export function markQuestionEdited(question: Question, updates: Partial<Question>): Question {
  return {
    ...question,
    ...updates,
    origin: question.origin === "manual" ? "manual" : "edited",
  };
}

/**
 * Toggles pin status on a question.
 */
export function toggleQuestionPin(question: Question): Question {
  return {
    ...question,
    isPinned: !question.isPinned,
  };
}
