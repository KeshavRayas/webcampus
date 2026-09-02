"use client";

import { authClient } from "@/lib/auth-client";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import axios from "axios";
import { Lock, ShieldCheck, UnlockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseDetailsCard } from "./course-details-card";
import {
  CourseMappingFilters,
  CourseMappingFiltersState,
} from "./course-mapping-filters";
import { CourseMappingGrid } from "./course-mapping-grid";

export const CourseMappingView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const isAdmin = session?.user?.role === "admin";

  const [appliedFilters, setAppliedFilters] =
    useState<CourseMappingFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CourseResponseDTO | null>(null);

  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{ type: string; name: string; id: string }>
      >(`${NEXT_PUBLIC_API_BASE_URL}/department/section/department-info`, {
        withCredentials: true,
      });
      if (res.data.status === "success") return res.data.data;
      return null;
    },
    enabled: !!session?.user?.id,
  });

  const isCourseLocked =
    selectedCourse?.approvalStatus === "PENDING" ||
    selectedCourse?.approvalStatus === "APPROVED";

  const { data: termsData } = useAcademicTerms();
  const appliedTerm = termsData?.find((t) => t.id === appliedFilters?.termId);
  const isSupplementaryTerm = appliedTerm?.type === "supplementary";

  return (
    <div className="space-y-8">
      {isSupplementaryTerm ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="flex flex-col gap-1">
              <h5 className="font-medium leading-none tracking-tight">
                Supplementary term — read-only
              </h5>
              <div className="text-sm">
                This is a supplementary term — faculty assignments are managed
                in Courses → Supplementary Sections, not here. This mapping is
                read-only.
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
            onClick={() => {
              const target = isAdmin ? "/admin/courses" : "/department/courses";
              router.push(
                `${target}?academicTermId=${appliedFilters?.termId ?? ""}&semesterId=${appliedFilters?.semesterId ?? ""}`
              );
            }}
          >
            Go to Courses
          </Button>
        </div>
      ) : (
        <>
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
                  This course is locked, but you have Admin privileges. Any
                  edits made will be saved to the audit log.
                </div>
              </div>
            </div>
          )}
        </>
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
                  isSupplementaryTerm={isSupplementaryTerm}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
