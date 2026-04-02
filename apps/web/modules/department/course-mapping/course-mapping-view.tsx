"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import axios from "axios";
import { Lock } from "lucide-react";
import { useState } from "react";
import { CourseDetailsCard } from "./course-details-card";
import {
  CourseMappingFilters,
  CourseMappingFiltersState,
} from "./course-mapping-filters";
import { CourseMappingGrid } from "./course-mapping-grid";

export const CourseMappingView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();

  const [appliedFilters, setAppliedFilters] =
    useState<CourseMappingFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CourseResponseDTO | null>(null);

  // Fetch department type for conditional rendering
  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<{ type: string; name: string }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/department-info`,
        {
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return { type: "", name: "" };
    },
    enabled: !!session?.user?.id,
  });

  const isBasicSciences = deptInfo?.type === "BASIC_SCIENCES";
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
                <h3 className="mb-4 text-lg font-semibold">
                  Faculty Assignments
                </h3>
                <CourseMappingGrid
                  course={selectedCourse}
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
