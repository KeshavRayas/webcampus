"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import axios from "axios";
import { useState } from "react";
import {
  CourseApprovalsFilters,
  CourseApprovalsFiltersState,
} from "./course-approvals-filters";
import { CourseApprovalsTable } from "./course-approvals-table";

export const CourseApprovalsView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();
  const [appliedFilters, setAppliedFilters] =
    useState<CourseApprovalsFiltersState | null>(null);

  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<{ type: string; name: string }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/department-info`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return null;
    },
    enabled: !!session?.user?.id,
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Course Approvals
        </h2>
        <p className="text-muted-foreground text-sm">
          Submit courses mapped for this semester for administrative approval.
          Once submitted, they will be locked from further edits.
        </p>
      </div>

      <CourseApprovalsFilters
        deptInfo={deptInfo || null}
        onAppliedFiltersChange={setAppliedFilters}
      />

      <CourseApprovalsTable
        deptInfo={deptInfo || null}
        appliedFilters={appliedFilters}
      />
    </div>
  );
};
