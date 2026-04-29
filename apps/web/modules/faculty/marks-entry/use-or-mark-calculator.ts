"use client";

import { useCallback } from "react";

interface Question {
  id: string;
  part: string;
  qNumber: string;
  marks: number;
  orGroupId?: string | null;
}

interface StudentMarks {
  [questionId: string]: number;
}

/**
 * Hook to calculate total marks respecting OR group logic perfectly
 *
 * - Groups questions by part.
 * - Mandatory questions (no orGroupId) are summed.
 * - For EACH orGroupId, the highest scored question is found using Math.max().
 * - Those maximums are then summed and added to the part total.
 * - Returns if a student has attempted multiple questions within the same orGroup.
 */
export function useOrMarkCalculator(questions: Question[]) {
  const calculateTotalMarks = useCallback(
    (
      studentMarks: StudentMarks
    ): { totalMarks: number; hasMultipleOrAttempts: boolean } => {
      const questionsByPart = new Map<string, Question[]>();

      questions.forEach((q) => {
        if (!questionsByPart.has(q.part)) {
          questionsByPart.set(q.part, []);
        }
        questionsByPart.get(q.part)!.push(q);
      });

      let totalMarks = 0;
      let hasMultipleOrAttempts = false;

      questionsByPart.forEach((partQuestions) => {
        const orGroupMaxes = new Map<
          string,
          { maxMark: number; attemptsCount: number }
        >();
        let standaloneSum = 0;

        partQuestions.forEach((q) => {
          const marks = studentMarks[q.id] || 0;
          if (q.orGroupId) {
            const current = orGroupMaxes.get(q.orGroupId) || {
              maxMark: 0,
              attemptsCount: 0,
            };
            const newMax = Math.max(current.maxMark, marks);
            const newAttempts =
              marks > 0 ? current.attemptsCount + 1 : current.attemptsCount;
            orGroupMaxes.set(q.orGroupId, {
              maxMark: newMax,
              attemptsCount: newAttempts,
            });
          } else {
            standaloneSum += marks;
          }
        });

        let orSum = 0;

        orGroupMaxes.forEach((group) => {
          orSum += group.maxMark;
          if (group.attemptsCount > 1) {
            hasMultipleOrAttempts = true;
          }
        });

        totalMarks += standaloneSum + orSum;
      });

      return { totalMarks, hasMultipleOrAttempts };
    },
    [questions]
  );

  return { calculateTotalMarks };
}
