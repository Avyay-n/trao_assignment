import { Question, Requirement, Schedule, ScheduleDay } from "../types/index.js";

/**
 * Deterministically generates a study schedule using pure code arithmetic.
 *
 * Requirements:
 * - Exactly `daysRequested` days in the output.
 * - Every must-have requirement appears in at least one scheduled question.
 * - Harder (diff: 3) and must-have questions land earlier, not the night before.
 * - Durations are integer minutes.
 * - Every question_ids entry refers to an existing question.
 */
export function buildSchedule(
  daysRequested: number,
  questions: Question[],
  requirements: Requirement[]
): Schedule {
  const daysCount = Math.max(1, Math.floor(daysRequested));

  if (questions.length === 0) {
    // Edge case: no questions generated (thin JD or total fallback)
    const fallbackDays: ScheduleDay[] = Array.from({ length: daysCount }, (_, i) => ({
      day: i + 1,
      focus: i === 0 ? "Review Role and Company Foundations" : `General Preparation & Review Day ${i + 1}`,
      question_ids: [],
      minutes: 45,
    }));
    return { days_available: daysCount, days: fallbackDays };
  }

  // Create lookup for requirement priority
  const reqPriorityMap = new Map<string, "must" | "nice">();
  for (const r of requirements) {
    reqPriorityMap.set(r.id, r.priority);
  }

  // Score questions for early placement:
  // Must-have reqs: +1000
  // Difficulty: 3 -> +300, 2 -> +200, 1 -> +100
  // System-design & Technical prioritized over company-fit early on
  const scoredQuestions = questions.map((q) => {
    let score = 0;
    const hasMust = q.requirement_ids.some((id: string) => reqPriorityMap.get(id) === "must");
    if (hasMust) score += 1000;

    score += (q.difficulty || 2) * 100;

    if (q.category === "system-design") score += 50;
    if (q.category === "technical") score += 40;
    if (q.category === "behavioural") score += 20;
    if (q.category === "company-fit") score += 10;

    return { question: q, score, hasMust };
  });

  // Sort descending: highest priority & hardest questions come first
  scoredQuestions.sort((a, b) => b.score - a.score);

  const days: ScheduleDay[] = [];

  // Case 1: 1-Day Cram Schedule
  if (daysCount === 1) {
    // Include all questions, starting with the hardest must-haves
    const qIds = scoredQuestions.map((s) => s.question.id);
    const totalMinutes = Math.min(240, Math.max(60, qIds.length * 15));
    return {
      days_available: 1,
      days: [
        {
          day: 1,
          focus: "Comprehensive Must-Have & High-Impact Preparation",
          question_ids: qIds,
          minutes: Math.round(totalMinutes),
        },
      ],
    };
  }

  // Case 2: Multi-day schedule (2 to 60+ days)
  // Ensure every must-have is scheduled early
  // We allocate questions across the available days.
  const dayBuckets: string[][] = Array.from({ length: daysCount }, () => []);

  // Strategy:
  // First, place must-have questions in earlier half of days.
  const mustQuestions = scoredQuestions.filter((s) => s.hasMust);
  const otherQuestions = scoredQuestions.filter((s) => !s.hasMust);

  if (daysCount >= scoredQuestions.length) {
    // More days than questions (e.g., 60 days, 15 questions)
    // Front-load questions in early days, then create review/reinforcement/mock interview days
    for (let i = 0; i < scoredQuestions.length; i++) {
      dayBuckets[i].push(scoredQuestions[i].question.id);
    }

    // Distribute remaining days with review sets of previous questions
    for (let dayIdx = scoredQuestions.length; dayIdx < daysCount; dayIdx++) {
      // Pick 1-2 questions for review based on cyclic difficulty
      const reviewIdx = dayIdx % scoredQuestions.length;
      dayBuckets[dayIdx].push(scoredQuestions[reviewIdx].question.id);
    }
  } else {
    // Fewer days than questions (e.g. 5 days, 15 questions)
    // Group must questions into early days
    const earlyDays = Math.max(1, Math.floor(daysCount * 0.7)); // first 70% of days for must-haves

    mustQuestions.forEach((mq, idx) => {
      const targetDay = idx % earlyDays;
      dayBuckets[targetDay].push(mq.question.id);
    });

    // Distribute other questions across middle and later days
    otherQuestions.forEach((oq, idx) => {
      const targetDay = Math.min(daysCount - 1, Math.floor(earlyDays / 2) + (idx % (daysCount - Math.floor(earlyDays / 2))));
      dayBuckets[targetDay].push(oq.question.id);
    });
  }

  // Ensure every single must-have requirement has at least one question in dayBuckets
  // (Double-check guarantee)
  const scheduledQIds = new Set(dayBuckets.flat());
  for (const mq of mustQuestions) {
    if (!scheduledQIds.has(mq.question.id)) {
      dayBuckets[0].push(mq.question.id);
      scheduledQIds.add(mq.question.id);
    }
  }

  // Generate appropriate focus and integer minutes for each day
  for (let d = 0; d < daysCount; d++) {
    const qIds = dayBuckets[d];
    const dayNum = d + 1;

    let focus = "";
    if (dayNum === 1) {
      focus = "Deep Dive: Core Architectural & High-Priority Technical Foundations";
    } else if (dayNum === daysCount) {
      focus = "Final Polish: Behavioural Scenarios, Company Values & Rapid Review";
    } else if (dayNum === daysCount - 1 && daysCount >= 3) {
      focus = "System Simulation: Behavioural Alignment & Cross-Domain Practice";
    } else if (d < Math.ceil(daysCount / 2)) {
      focus = `Targeted Mastery: Core Must-Have Competencies (Part ${dayNum})`;
    } else {
      focus = `Secondary Skills & Comprehensive Practice Drill (Day ${dayNum})`;
    }

    // Base minutes: 15 mins per question, clamped between 30 and 120 mins
    const rawMinutes = Math.max(30, Math.min(120, qIds.length * 15 || 45));
    const minutes = Math.round(rawMinutes);

    days.push({
      day: dayNum,
      focus,
      question_ids: qIds,
      minutes,
    });
  }

  return {
    days_available: daysCount,
    days,
  };
}
