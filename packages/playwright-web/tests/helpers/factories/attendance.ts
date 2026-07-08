let _seq = 0;

export type MakeAttendanceSessionInput = {
  courseId: string;
  sectionId: string;
  facultyId: string;
  sessionDate?: string;
  timingCode?: string;
  timingStartTime?: string;
  timingEndTime?: string;
  batchId?: string;
};

export function makeAttendanceSession(
  overrides: {
    courseId: string;
    sectionId: string;
    facultyId: string;
  } & Partial<MakeAttendanceSessionInput>
) {
  _seq++;
  const day = String(10 + _seq).padStart(2, "0");
  return {
    courseId: overrides.courseId,
    sectionId: overrides.sectionId,
    facultyId: overrides.facultyId,
    sessionDate: overrides.sessionDate ?? `2026-06-${day}T00:00:00.000Z`,
    timingCode: overrides.timingCode ?? "FIXED_1",
    timingStartTime: overrides.timingStartTime ?? "08:00",
    timingEndTime: overrides.timingEndTime ?? "08:55",
    batchId: overrides.batchId,
  };
}
