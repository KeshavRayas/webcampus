"use client";

import { authClient } from "@/lib/auth-client";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { CourseDetailsCard } from "./course-details-card";
import { CourseMappingFilters, CourseMappingFiltersState } from "./course-mapping-filters";
import { CourseMappingGrid } from "./course-mapping-grid";

export const CourseMappingView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();

  const [appliedFilters, setAppliedFilters] = useState<CourseMappingFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseResponseDTO | null>(null);

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

  return (
    <div className="space-y-8">
      <CourseMappingFilters
        deptInfo={deptInfo ?? null}
        onCourseSelect={setSelectedCourse}
        onAppliedFiltersChange={setAppliedFilters}
        appliedFilters={appliedFilters}
      />

      {selectedCourse && appliedFilters?.semesterId && appliedFilters?.academicYear && (
        <div className="flex flex-col gap-6 w-full">
          <CourseDetailsCard course={selectedCourse} />
          
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Faculty Assignments</h3>
              <CourseMappingGrid
                course={selectedCourse}
                semesterId={appliedFilters.semesterId}
                academicYear={appliedFilters.academicYear}
                cycle={appliedFilters.cycle}
                isBasicSciences={isBasicSciences}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
