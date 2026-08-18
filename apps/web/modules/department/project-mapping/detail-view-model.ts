export const PW_DETAIL_TABS = [
  { value: "students", label: "Students" },
  { value: "faculty-groups", label: "Faculty & Groups" },
] as const;

export type FacultyOptionLike = {
  id: string;
  name: string;
};

export type StudentLike = {
  studentId: string;
};

export type GroupLike = {
  id: string;
  name: string;
  sectionName: string | null;
  studentCount: number;
  studentsPerGroup: number;
  facultyId: string | null;
  facultyName: string | null;
  status: "ASSIGNED" | "UNASSIGNED";
};

export type FacultyGroupRow = {
  id: string;
  name: string;
  sectionName: string | null;
  studentsLabel: string;
  status: "ASSIGNED" | "UNASSIGNED";
  facultyId: string | null;
  facultyName: string | null;
};

export type GroupDetailLike = {
  group: {
    id: string;
    name: string;
    sectionName: string | null;
    studentsPerGroup: number;
    facultyId: string | null;
    facultyName: string | null;
  };
  members: {
    studentId: string;
    usn: string;
    name: string;
    sectionName: string | null;
  }[];
};

export type GroupDetailModel = {
  groupName: string;
  sectionName: string | null;
  studentsLabel: string;
  facultyId: string | null;
  facultyName: string | null;
  members: GroupDetailLike["members"];
};

export function deriveStudentFaculty(
  student: StudentLike,
  localAssignments: Record<string, string | null>,
  localFaculty: Record<string, string | null>,
  facultyOptions: FacultyOptionLike[]
): string | null {
  const groupId = localAssignments[student.studentId];
  if (!groupId) return null;
  const facultyId = localFaculty[groupId] ?? null;
  if (!facultyId) return null;
  return facultyOptions.find((f) => f.id === facultyId)?.name ?? null;
}

export function buildFacultyGroupRows(
  groups: GroupLike[],
  localFaculty: Record<string, string | null>,
  facultyOptions: FacultyOptionLike[]
): FacultyGroupRow[] {
  return groups.map((g) => {
    const facultyId = localFaculty[g.id] ?? g.facultyId ?? null;
    const facultyName = facultyId
      ? (facultyOptions.find((f) => f.id === facultyId)?.name ?? g.facultyName)
      : g.facultyName;
    return {
      id: g.id,
      name: g.name,
      sectionName: g.sectionName,
      studentsLabel: `${g.studentCount} / ${g.studentsPerGroup}`,
      status: g.status,
      facultyId,
      facultyName,
    };
  });
}

export function buildGroupDetailModel(
  detail: GroupDetailLike,
  localFaculty: Record<string, string | null>,
  facultyOptions: FacultyOptionLike[]
): GroupDetailModel {
  const groupId = detail.group.id;
  const facultyId = localFaculty[groupId] ?? detail.group.facultyId ?? null;
  const facultyName = facultyId
    ? (facultyOptions.find((f) => f.id === facultyId)?.name ??
      detail.group.facultyName)
    : detail.group.facultyName;
  return {
    groupName: detail.group.name,
    sectionName: detail.group.sectionName,
    studentsLabel: `${detail.members.length} / ${detail.group.studentsPerGroup}`,
    facultyId,
    facultyName,
    members: detail.members,
  };
}

export type SavePayloadInput = {
  courseId: string;
  electiveMappingVersion: number;
  localAssignments: Record<string, string | null>;
  localFaculty: Record<string, string | null>;
  departmentId?: string;
};

export function buildSavePayload(
  input: SavePayloadInput
): Record<string, unknown> {
  return {
    courseId: input.courseId,
    electiveMappingVersion: input.electiveMappingVersion,
    assignments: Object.entries(input.localAssignments)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([studentId, electiveBatchId]) => ({ studentId, electiveBatchId })),
    faculty: Object.entries(input.localFaculty).map(
      ([electiveBatchId, facultyId]) => ({ electiveBatchId, facultyId })
    ),
    departmentId: input.departmentId,
  };
}

export type ExcelAssignmentInput = {
  studentId: string;
  electiveBatchId: string;
};

export type ExcelFacultyAssignmentInput = {
  electiveBatchId: string;
  facultyId: string | null;
};

export type ExcelPreviewInput = {
  assignments: ExcelAssignmentInput[];
  facultyAssignments: ExcelFacultyAssignmentInput[];
  students: {
    studentId: string;
    usn: string;
    name: string;
    sectionName: string | null;
  }[];
  batches: {
    id: string;
    name: string;
    sectionName: string | null;
  }[];
  facultyOptions: FacultyOptionLike[];
  currentAssignments: Record<string, string | null>;
  currentFaculty: Record<string, string | null>;
};

export type ExcelPreviewStudentChange = {
  studentId: string;
  usn: string;
  name: string;
  sectionName: string | null;
  previousGroupName: string | null;
  nextGroupName: string | null;
};

export type ExcelPreviewFacultyChange = {
  electiveBatchId: string;
  groupName: string;
  sectionName: string | null;
  previousFacultyName: string | null;
  nextFacultyName: string | null;
};

export type ExcelPreviewModel = {
  studentChanges: ExcelPreviewStudentChange[];
  facultyChanges: ExcelPreviewFacultyChange[];
};

export function buildExcelPreviewModel(
  input: ExcelPreviewInput
): ExcelPreviewModel {
  const batchNameById = new Map(input.batches.map((b) => [b.id, b.name]));
  const batchSectionById = new Map(
    input.batches.map((b) => [b.id, b.sectionName])
  );
  const facultyNameById = new Map(
    input.facultyOptions.map((f) => [f.id, f.name])
  );
  const studentInfo = new Map(input.students.map((s) => [s.studentId, s]));

  const studentChanges: ExcelPreviewStudentChange[] = [];
  for (const a of input.assignments) {
    const info = studentInfo.get(a.studentId);
    const previousGroupId = input.currentAssignments[a.studentId] ?? null;
    if (previousGroupId === a.electiveBatchId) continue;
    const previousGroupName = previousGroupId
      ? (batchNameById.get(previousGroupId) ?? null)
      : null;
    studentChanges.push({
      studentId: a.studentId,
      usn: info?.usn ?? a.studentId,
      name: info?.name ?? "",
      sectionName: info?.sectionName ?? null,
      previousGroupName,
      nextGroupName: batchNameById.get(a.electiveBatchId) ?? null,
    });
  }

  const facultyChanges: ExcelPreviewFacultyChange[] = [];
  for (const f of input.facultyAssignments) {
    const previousFacultyId = input.currentFaculty[f.electiveBatchId] ?? null;
    if (previousFacultyId === f.facultyId) continue;
    const previousFacultyName = previousFacultyId
      ? (facultyNameById.get(previousFacultyId) ?? null)
      : null;
    facultyChanges.push({
      electiveBatchId: f.electiveBatchId,
      groupName: batchNameById.get(f.electiveBatchId) ?? f.electiveBatchId,
      sectionName: batchSectionById.get(f.electiveBatchId) ?? null,
      previousFacultyName,
      nextFacultyName: f.facultyId
        ? (facultyNameById.get(f.facultyId) ?? null)
        : null,
    });
  }

  return { studentChanges, facultyChanges };
}
