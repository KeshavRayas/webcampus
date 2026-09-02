"use client";

import { CourseResponseDTO } from "@webcampus/schemas/department";
import { AdminRegularCourseBlock } from "./admin-regular-course-block";
import { AdminSupplementaryOfferingBlock } from "./admin-supplementary-offering-block";

type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

interface TermBundle {
  id: string;
  type: string;
  parity: string | null;
  year: string;
}

interface AdminSemesterCourseBlockProps {
  semesterId: string;
  semesterNumber: number;
  courses: CourseResponseDTO[];
  selectedCycle: CourseCycle;
  selectedDepartmentId: string;
  selectedDepartmentName: string;
  isBasicSciences: boolean;
  isSemesterLocked: boolean;
  termType?: string;
  termParity?: string | null;
  academicTermId?: string;
  termYear?: string;
  term?: TermBundle;
}

export const AdminSemesterCourseBlock = ({
  semesterId,
  semesterNumber,
  courses,
  selectedCycle,
  selectedDepartmentId,
  selectedDepartmentName,
  isBasicSciences,
  isSemesterLocked,
  termType,
  termParity,
  academicTermId,
  termYear,
  term,
}: AdminSemesterCourseBlockProps) => {
  const bundle: TermBundle | null =
    term ??
    (academicTermId
      ? {
          id: academicTermId,
          type: termType ?? "odd",
          parity: termParity ?? null,
          year: termYear ?? "",
        }
      : null);

  const isSupplementary = bundle?.type === "supplementary";

  if (isSupplementary && bundle) {
    return (
      <AdminSupplementaryOfferingBlock
        semesterId={semesterId}
        semesterNumber={semesterNumber}
        term={bundle}
      />
    );
  }

  return (
    <AdminRegularCourseBlock
      semesterId={semesterId}
      semesterNumber={semesterNumber}
      courses={courses}
      selectedCycle={selectedCycle}
      selectedDepartmentId={selectedDepartmentId}
      selectedDepartmentName={selectedDepartmentName}
      isBasicSciences={isBasicSciences}
      isSemesterLocked={isSemesterLocked}
    />
  );
};
