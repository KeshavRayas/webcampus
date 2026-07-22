"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import axios from "axios";
import { useMemo, useState } from "react";
import { getApprovalBadgeConfig } from "./course-approval-status";
import { CourseApprovalsFilters } from "./course-approvals-filters";
import { CourseReviewSheet } from "./course-review-sheet";

export interface GroupedCourse {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  semesterId: string;
  semester: {
    semesterNumber: number;
    academicTerm?: { type: string; year: string };
  };
  cycle: string;
  approvalStatus: "DRAFT" | "PENDING" | "APPROVED" | "NEEDS_REVISION";
  hasAdminApproved: boolean;
  hasCoeApproved: boolean;
  courseCount: number;
  courses: Array<{
    id: string;
    name: string;
    code: string;
    courseType: string;
    totalCredits: number;
    courseMode: string;
    approvalStatus: "DRAFT" | "PENDING" | "APPROVED" | "NEEDS_REVISION";
    hasAdminApproved: boolean;
    hasCoeApproved: boolean;
  }>;
  hasPostApprovalEdits: boolean;
  overrideCount: number;
  lastOverrideAt: string | null;
  lastOverrideById: string | null;
}

const EMPTY_FILTERS = {
  termId: "",
  semesterId: "",
  cycle: "",
  departmentName: "",
  status: "",
};

export const CourseApprovalsView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [selectedGroup, setSelectedGroup] = useState<GroupedCourse | null>(
    null
  );
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const {
    data: groups,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-course-approvals"],
    queryFn: async () => {
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/pending-submissions`,
        {
          withCredentials: true,
        }
      );
      return res.data.data;
    },
  });

  const filteredGroups = useMemo(() => {
    const list = groups ?? [];
    if (
      !appliedFilters.termId &&
      !appliedFilters.semesterId &&
      !appliedFilters.departmentName &&
      !appliedFilters.status &&
      !appliedFilters.cycle
    ) {
      return list;
    }

    return list.filter((g: GroupedCourse) => {
      if (appliedFilters.termId) {
        const [type, year] = appliedFilters.termId.split("_");
        if (
          g.semester?.academicTerm?.type !== type ||
          g.semester?.academicTerm?.year !== year
        )
          return false;
      }
      if (appliedFilters.semesterId) {
        if (String(g.semester?.semesterNumber) !== appliedFilters.semesterId)
          return false;
      }
      if (appliedFilters.cycle) {
        if (g.cycle !== appliedFilters.cycle) return false;
      }
      if (appliedFilters.departmentName) {
        if (g.departmentName !== appliedFilters.departmentName) return false;
      }
      if (appliedFilters.status) {
        if (g.approvalStatus !== appliedFilters.status) return false;
      }
      return true;
    });
  }, [groups, appliedFilters]);

  const columns: ColumnDef<GroupedCourse>[] = [
    {
      accessorKey: "departmentName",
      header: "Department",
    },
    {
      accessorKey: "semester.semesterNumber",
      header: "Semester",
      cell: ({ row }) => {
        const num = row.original.semester?.semesterNumber;
        return num ? `Semester ${num}` : "N/A";
      },
    },
    {
      accessorKey: "cycle",
      header: "Cycle",
      cell: ({ row }) => {
        const cycle = row.original.cycle;
        return cycle === "NONE" ? "N/A" : cycle;
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const badge = getApprovalBadgeConfig({
          approvalStatus: row.original.approvalStatus,
          hasAdminApproved: row.original.hasAdminApproved,
          hasCoeApproved: row.original.hasCoeApproved,
        });

        return (
          <Badge variant={badge.variant} className={badge.className}>
            {badge.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "courseCount",
      header: "Courses",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedGroup(row.original)}
          >
            View Details
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Course Approvals</h2>
        <p className="text-muted-foreground text-sm">
          Review and approve semester courses submitted by departments.
        </p>
      </div>

      {groups && groups.length > 0 && (
        <CourseApprovalsFilters
          groups={groups}
          draftFilters={draftFilters}
          appliedFilters={appliedFilters}
          onDraftChange={(key, value) =>
            setDraftFilters((current) => {
              const next = { ...current, [key]: value };
              if (key === "termId") next.semesterId = "";
              return next;
            })
          }
          onApply={() => setAppliedFilters(draftFilters)}
          onReset={() => {
            setDraftFilters(EMPTY_FILTERS);
            setAppliedFilters(EMPTY_FILTERS);
          }}
        />
      )}

      {isLoading ? (
        <div className="text-muted-foreground p-8 text-center text-sm">
          Loading course submissions...
        </div>
      ) : isError ? (
        <div className="border-destructive/50 bg-destructive/10 rounded-lg border p-12 text-center">
          <p className="text-destructive text-sm font-medium">
            Failed to load course submissions
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            Try Again
          </Button>
        </div>
      ) : filteredGroups.length > 0 ? (
        <div className="bg-card rounded-md border">
          <DataTable columns={columns} data={filteredGroups} />
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
          {groups && groups.length > 0
            ? "No submissions match the selected filters."
            : "No course submissions to review."}
        </div>
      )}

      {selectedGroup && (
        <CourseReviewSheet
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onSuccess={() => {
            setSelectedGroup(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};
