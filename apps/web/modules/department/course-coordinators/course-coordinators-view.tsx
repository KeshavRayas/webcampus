"use client";

import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Lock } from "lucide-react";
import { useState } from "react";
import { CourseDetailsCard } from "../course-mapping/course-details-card";
import {
  CourseCoordinatorFilters,
  CourseCoordinatorFiltersState,
} from "./course-coordinator-filters";
import { ManageCoordinatorsCard } from "./manage-coordinators-card";

export const CourseCoordinatorsView = () => {
  const { data: session } = authClient.useSession();

  const [appliedFilters, setAppliedFilters] =
    useState<CourseCoordinatorFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CourseResponseDTO | null>(null);

  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<{ type: string; name: string }>
      >(`/department/section/department-info`);
      if (res.data.status === "success") return res.data.data;
      return { type: "", name: "" };
    },
    enabled: !!session?.user?.id,
  });

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
              review/approval. Coordinator assignments cannot be altered.
            </div>
          </div>
        </div>
      )}

      <CourseCoordinatorFilters
        deptInfo={deptInfo ?? null}
        onCourseSelect={setSelectedCourse}
        onAppliedFiltersChange={setAppliedFilters}
        appliedFilters={appliedFilters}
      />

      {selectedCourse && appliedFilters?.semesterId && (
        <div className="flex w-full flex-col gap-6">
          <CourseDetailsCard course={selectedCourse} />

          <ManageCoordinatorsCard
            course={selectedCourse}
            isLocked={isCourseLocked}
          />
        </div>
      )}
    </div>
  );
};
