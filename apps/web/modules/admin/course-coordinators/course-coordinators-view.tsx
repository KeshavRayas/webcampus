"use client";

import { AuditHistoryDialog } from "@/components/admin/audit-history-dialog";
import { CourseDetailsCard } from "@/modules/department/course-mapping/course-details-card";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  AdminCourseCoordinatorFilters,
  CourseCoordinatorFiltersState,
} from "./course-coordinator-filters";
import { ManageCoordinatorsCard } from "./manage-coordinators-card";

export const AdminCourseCoordinatorsView = () => {
  const [appliedFilters, setAppliedFilters] =
    useState<CourseCoordinatorFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CourseResponseDTO | null>(null);

  const isCourseLocked =
    selectedCourse?.approvalStatus === "PENDING" ||
    selectedCourse?.approvalStatus === "APPROVED";

  return (
    <div className="space-y-8">
      {isCourseLocked && (
        <div className="border-primary/20 bg-primary/10 text-primary flex items-start gap-3 rounded-lg border p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-medium leading-none tracking-tight">
              Admin Override Enabled
            </h5>
            <div className="text-sm">
              This course is {selectedCourse?.approvalStatus?.toLowerCase()}.
              You have override privileges to modify coordinator assignments.
            </div>
          </div>
        </div>
      )}

      <AdminCourseCoordinatorFilters
        onCourseSelect={setSelectedCourse}
        onAppliedFiltersChange={setAppliedFilters}
        appliedFilters={appliedFilters}
      />

      {selectedCourse && appliedFilters?.semesterId && (
        <div className="flex w-full flex-col gap-6">
          <CourseDetailsCard course={selectedCourse}>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <AuditHistoryDialog courseId={selectedCourse.id} />
              {selectedCourse.lastOverrideAt && (
                <span className="text-muted-foreground text-left text-xs md:text-right">
                  Last override:{" "}
                  {new Date(selectedCourse.lastOverrideAt).toLocaleString()}
                </span>
              )}
            </div>
          </CourseDetailsCard>

          <ManageCoordinatorsCard course={selectedCourse} />
        </div>
      )}
    </div>
  );
};
