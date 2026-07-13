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
  seeMinMarks?: number;
  seeWeightage?: number;
  maxNoOfCies?: number;
  minNoOfCies?: number;
  cieMaxMarks?: number;
  cieMinMarks?: number;
  cieWeightage?: number;
  noOfAssignments?: number;
  assignmentMaxMarks?: number;
  labMaxMarks?: number;
  labMinMarks?: number;
  labWeightage?: number;
  cumulativeMaxMarks?: number;
  cumulativeMinMarks?: number;
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
    seeMinMarks: overrides.seeMinMarks ?? 40,
    seeWeightage: overrides.seeWeightage ?? 100,
    maxNoOfCies: overrides.maxNoOfCies ?? 3,
    minNoOfCies: overrides.minNoOfCies ?? 2,
    cieMaxMarks: overrides.cieMaxMarks ?? 40,
    cieMinMarks: overrides.cieMinMarks ?? 0,
    cieWeightage: overrides.cieWeightage ?? 100,
    noOfAssignments: overrides.noOfAssignments ?? 2,
    assignmentMaxMarks: overrides.assignmentMaxMarks ?? 10,
    labMaxMarks: overrides.labMaxMarks ?? 0,
    labMinMarks: overrides.labMinMarks ?? 0,
    labWeightage: overrides.labWeightage ?? 0,
    cumulativeMaxMarks: overrides.cumulativeMaxMarks ?? 100,
    cumulativeMinMarks: overrides.cumulativeMinMarks ?? 40,
  };
}
