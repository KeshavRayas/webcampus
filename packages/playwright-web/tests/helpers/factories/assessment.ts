let _seq = 0;

export type AssessmentQuestionInput = {
  part: "A" | "B" | "C";
  qNumber: number;
  marks: number;
  co: number;
  po: number;
  bl: number;
  orGroupId?: number;
};

export type MakeAssessmentInput = {
  courseId: string;
  semesterId: string;
  title?: string;
  totalMarks?: number;
  questions?: AssessmentQuestionInput[];
};

export function makeAssessment(
  overrides: {
    courseId: string;
    semesterId: string;
  } & Partial<MakeAssessmentInput>
) {
  _seq++;
  return {
    title: overrides.title ?? `CIE-${_seq}`,
    totalMarks: overrides.totalMarks ?? 50,
    courseId: overrides.courseId,
    semesterId: overrides.semesterId,
    questions: overrides.questions ?? [
      { part: "A", qNumber: 1, marks: 2, co: 1, po: 1, bl: 1 },
      { part: "A", qNumber: 2, marks: 2, co: 1, po: 1, bl: 2 },
      { part: "B", qNumber: 3, marks: 6, co: 2, po: 2, bl: 3 },
      { part: "B", qNumber: 4, marks: 6, co: 2, po: 2, bl: 3 },
      { part: "C", qNumber: 5, marks: 8, co: 3, po: 3, bl: 4 },
      { part: "C", qNumber: 6, marks: 8, co: 3, po: 3, bl: 4 },
      { part: "C", qNumber: 7, marks: 8, co: 3, po: 3, bl: 4 },
      { part: "C", qNumber: 8, marks: 8, co: 3, po: 3, bl: 4 },
      { part: "C", qNumber: 9, marks: 8, co: 3, po: 3, bl: 4 },
      { part: "C", qNumber: 10, marks: 8, co: 3, po: 3, bl: 4 },
    ],
  };
}
