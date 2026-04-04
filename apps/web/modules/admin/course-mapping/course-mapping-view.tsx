"use client";

import { useDepartments } from "@/lib/use-departments";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { CourseDetailsCard } from "../../department/course-mapping/course-details-card";
import {
  AdminCourseMappingFilters,
  AdminCourseMappingFiltersState,
} from "./course-mapping-filters";
import { AdminCourseMappingGrid } from "./course-mapping-grid";

export const AdminCourseMappingView = () => {
  const { data: departments = [] } = useDepartments();
  const [appliedFilters, setAppliedFilters] =
    useState<AdminCourseMappingFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CourseResponseDTO | null>(null);

  const selectedDepartment = useMemo(
    () =>
      departments.find(
        (department) => department.name === appliedFilters?.departmentName
      ),
    [appliedFilters?.departmentName, departments]
  );

  const isBasicSciences = selectedDepartment?.type === "BASIC_SCIENCES";
  const isCourseLocked =
    selectedCourse?.approvalStatus === "PENDING" ||
    selectedCourse?.approvalStatus === "APPROVED";

  return (
    <div className="space-y-8">
      {isCourseLocked && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-4">
          <Lock className="mt-0.5 h-5 w-5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-medium leading-none tracking-tight">
              Course Locked
            </h5>
            <div className="text-sm">
              This course is part of a semester that is locked for
              review/approval. Mappings cannot be altered.
            </div>
          </div>
        </div>
      )}

      <AdminCourseMappingFilters
        onCourseSelect={setSelectedCourse}
        onAppliedFiltersChange={setAppliedFilters}
      />

      {selectedCourse &&
        appliedFilters?.departmentName &&
        appliedFilters?.semesterId &&
        appliedFilters?.academicYear && (
          <div className="flex w-full flex-col gap-6">
            <CourseDetailsCard course={selectedCourse} />

            <div className="bg-card text-card-foreground w-full overflow-hidden rounded-xl border shadow-sm">
              <div className="p-6">
                <h3 className="mb-4 text-lg font-semibold">
                  Faculty Assignments
                </h3>
                <AdminCourseMappingGrid
                  course={selectedCourse}
                  departmentName={appliedFilters.departmentName}
                  semesterId={appliedFilters.semesterId}
                  academicYear={appliedFilters.academicYear}
                  cycle={appliedFilters.cycle}
                  isBasicSciences={isBasicSciences}
                  isLocked={isCourseLocked}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
