"use client";

import { CourseResponseDTO } from "@webcampus/schemas/department";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import React from "react";
import { CourseFormFields } from "./course-form-fields";
import { DepartmentCoursesColumns } from "./department-courses-columns";
import { useCreateCourseForm } from "./use-create-course-form";

type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

interface SemesterCourseBlockProps {
  semesterId: string;
  semesterNumber: number;
  courses: CourseResponseDTO[];
  departmentType: string;
  programType: string;
  selectedCycle: CourseCycle;
  isBasicSciences: boolean;
  isSemesterLocked: boolean;
}

export const SemesterCourseBlock = ({
  semesterId,
  semesterNumber,
  courses,
  selectedCycle,
  isBasicSciences,
  isSemesterLocked,
}: SemesterCourseBlockProps) => {
  const { form, onSubmit } = useCreateCourseForm(
    semesterId,
    semesterNumber,
    selectedCycle
  );

  const hasValidBasicSciencesCycle =
    selectedCycle === "PHYSICS" || selectedCycle === "CHEMISTRY";
  const isAddCourseDisabled =
    (isBasicSciences && !hasValidBasicSciencesCycle) || isSemesterLocked;

  return (
    <div className="bg-card text-card-foreground mb-12 space-y-4 rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-tight">
          Semester {semesterNumber}
        </h3>
        <DialogForm
          trigger={
            <Button disabled={isAddCourseDisabled}>
              {`Add Course to Sem ${semesterNumber}`}
            </Button>
          }
          title={`Create Course (Semester ${semesterNumber})`}
          form={form}
          onSubmit={onSubmit}
          contentClassName="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <CourseFormFields form={form} />
        </DialogForm>
      </div>
      <DataTable columns={DepartmentCoursesColumns} data={courses} />
    </div>
  );
};
