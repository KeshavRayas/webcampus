"use client";

import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Lock, UnlockKeyhole } from "lucide-react";
import { useState } from "react";
import { CourseDetailsCard } from "./course-details-card";
import {
  CourseMappingFilters,
  CourseMappingFiltersState,
} from "./course-mapping-filters";
import { CourseMappingGrid } from "./course-mapping-grid";

export const CourseMappingView = () => {
  const { data: session } = authClient.useSession();

  const isAdmin = session?.user?.role === "admin";

  const [appliedFilters, setAppliedFilters] =
    useState<CourseMappingFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CourseResponseDTO | null>(null);

  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<{ type: string; name: string; id: string }>
      >(`/department/section/department-info`);
      if (res.data.status === "success") return res.data.data;
      return null;
    },
    enabled: !!session?.user?.id,
  });

  const isCourseLocked =
    selectedCourse?.approvalStatus === "PENDING" ||
    selectedCourse?.approvalStatus === "APPROVED";

  return (
    <div className="space-y-8">
      {isCourseLocked && !isAdmin && (
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

      {isCourseLocked && isAdmin && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-500/20 bg-orange-500/10 p-4 text-orange-600">
          <UnlockKeyhole className="mt-0.5 h-5 w-5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-medium leading-none tracking-tight">
              Super Edit Mode
            </h5>
            <div className="text-sm">
              This course is locked, but you have Admin privileges. Any edits
              made will be saved to the audit log.
            </div>
          </div>
        </div>
      )}

      <CourseMappingFilters
        deptInfo={deptInfo ?? null}
        onCourseSelect={setSelectedCourse}
        onAppliedFiltersChange={setAppliedFilters}
        appliedFilters={appliedFilters}
      />

      {selectedCourse &&
        appliedFilters?.semesterId &&
        appliedFilters?.academicYear && (
          <div className="flex w-full flex-col gap-6">
            <CourseDetailsCard course={selectedCourse} />

            <div className="bg-card text-card-foreground w-full overflow-hidden rounded-xl border shadow-sm">
              <div className="p-6">
                <CourseMappingGrid
                  course={selectedCourse}
                  semesterId={appliedFilters.semesterId}
                  academicYear={appliedFilters.academicYear}
                  cycle={appliedFilters.cycle}
                  isLocked={isCourseLocked}
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
