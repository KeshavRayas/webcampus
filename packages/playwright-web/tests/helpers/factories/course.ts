let _seq = 0;

export type MakeCourseInput = {
  departmentId: string;
  semesterId: string;
  semesterNumber: number;
  code?: string;
  name?: string;
  courseType?: "PC" | "PE" | "OE" | "NCMC";
  courseMode?: "INTEGRATED" | "NON_INTEGRATED" | "FINAL_SUMMARY" | "NCMC";
  lectureCredits?: number;
  tutorialCredits?: number;
  practicalCredits?: number;
  skillCredits?: number;
  seeMaxMarks?: number;
  seeEligibility?: number;
  cieMaxMarks?: number;
  cieEligibility?: number;
  theoryMaxExams?: number;
  theoryMinExams?: number;
  theoryExamMaxMarks?: number;
  theoryCieContribution?: number;
  theoryEligibility?: number;
  labMaxMarks?: number;
  labEligibility?: number;
  aatMaxMarks?: number;
  aatEligibility?: number;
};

export function makeCourse(
  overrides: {
    departmentId: string;
    semesterId: string;
    semesterNumber: number;
  } & Partial<MakeCourseInput>
) {
  _seq++;
  const suffix = `${_seq}${Date.now().toString(36).slice(-4)}`;
  return {
    code: overrides.code ?? `TEST${suffix}`,
    name: overrides.name ?? `Test Course ${_seq}`,
    courseType: overrides.courseType ?? "PC",
    courseMode: overrides.courseMode ?? "NON_INTEGRATED",
    departmentId: overrides.departmentId,
    semesterId: overrides.semesterId,
    semesterNumber: overrides.semesterNumber,
    lectureCredits: overrides.lectureCredits ?? 3,
    tutorialCredits: overrides.tutorialCredits ?? 0,
    practicalCredits: overrides.practicalCredits ?? 0,
    skillCredits: overrides.skillCredits ?? 0,
    seeMaxMarks: overrides.seeMaxMarks ?? 100,
    seeEligibility: overrides.seeEligibility ?? 40,
    cieMaxMarks: overrides.cieMaxMarks ?? 40,
    cieEligibility: overrides.cieEligibility ?? 40,
    theoryMaxExams: overrides.theoryMaxExams ?? 3,
    theoryMinExams: overrides.theoryMinExams ?? 2,
    theoryExamMaxMarks: overrides.theoryExamMaxMarks ?? 20,
    theoryCieContribution: overrides.theoryCieContribution ?? 30,
    theoryEligibility: overrides.theoryEligibility ?? 40,
    labMaxMarks: overrides.labMaxMarks ?? 0,
    labEligibility: overrides.labEligibility ?? 0,
    aatMaxMarks: overrides.aatMaxMarks ?? 10,
    aatEligibility: overrides.aatEligibility ?? 40,
  };
}
