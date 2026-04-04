"use client";

import { CourseResponseDTO } from "@webcampus/schemas/department";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import { CourseFormFields } from "../../department/courses/course-form-fields";
import { getAdminCoursesColumns } from "./admin-courses-columns";
import { useCreateAdminCourseForm } from "./use-create-admin-course-form";

type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

interface AdminSemesterCourseBlockProps {
  semesterId: string;
  semesterNumber: number;
  courses: CourseResponseDTO[];
  selectedCycle: CourseCycle;
  selectedDepartmentName: string;
  isBasicSciences: boolean;
  isSemesterLocked: boolean;
}

export const AdminSemesterCourseBlock = ({
  semesterId,
  semesterNumber,
  courses,
  selectedCycle,
  selectedDepartmentName,
  isBasicSciences,
  isSemesterLocked,
}: AdminSemesterCourseBlockProps) => {
  const { form, onSubmit } = useCreateAdminCourseForm(
    semesterId,
    semesterNumber,
    selectedDepartmentName,
    selectedCycle
  );

  const hasValidBasicSciencesCycle =
    selectedCycle === "PHYSICS" || selectedCycle === "CHEMISTRY";
  const isAddCourseDisabled =
    !selectedDepartmentName ||
    (isBasicSciences && !hasValidBasicSciencesCycle) ||
    isSemesterLocked;

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
      <DataTable
        columns={getAdminCoursesColumns(selectedDepartmentName, selectedCycle)}
        data={courses}
      />
    </div>
  );
};
