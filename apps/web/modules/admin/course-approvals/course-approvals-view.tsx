"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import axios from "axios";
import { useState } from "react";
import { getApprovalBadgeConfig } from "./course-approval-status";
import { CourseReviewSheet } from "./course-review-sheet";

export interface GroupedCourse {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  semesterId: string;
  semester: { semesterNumber: number };
  cycle: string;
  approvalStatus: "PENDING" | "APPROVED";
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
    approvalStatus: "PENDING" | "APPROVED";
    hasAdminApproved: boolean;
    hasCoeApproved: boolean;
  }>;
}

export const CourseApprovalsView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [selectedGroup, setSelectedGroup] = useState<GroupedCourse | null>(
    null
  );

  const {
    data: groups,
    isLoading,
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

      {isLoading ? (
        <div className="text-muted-foreground p-8 text-center text-sm">
          Loading course submissions...
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="bg-card rounded-md border">
          <DataTable columns={columns} data={groups} />
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
          No course submissions to review.
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
