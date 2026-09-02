"use client";

import { CourseResponseDTO } from "@webcampus/schemas/department";
import { AdminRegularCourseBlock } from "./admin-regular-course-block";
import { AdminSupplementaryOfferingBlock } from "./admin-supplementary-offering-block";
import type { TermBundle } from "./term-bundle";

type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

interface AdminSemesterCourseBlockProps {
  semesterId: string;
  semesterNumber: number;
  courses: CourseResponseDTO[];
  selectedCycle: CourseCycle;
  selectedDepartmentId: string;
  selectedDepartmentName: string;
  isBasicSciences: boolean;
  isSemesterLocked: boolean;
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
  term,
}: AdminSemesterCourseBlockProps) => {
  const bundle: TermBundle | null = term ?? null;

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
