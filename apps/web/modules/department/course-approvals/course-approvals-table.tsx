"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@webcampus/ui/components/alert-dialog";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@webcampus/ui/components/tooltip";
import axios, { AxiosError } from "axios";
import { useState } from "react";
import { toast } from "react-toastify";
import { CourseApprovalsFiltersState } from "./course-approvals-filters";

interface CourseApprovalsTableProps {
  deptInfo: { type: string; name: string } | null;
  appliedFilters: CourseApprovalsFiltersState | null;
}

export const CourseApprovalsTable = ({
  deptInfo,
  appliedFilters,
}: CourseApprovalsTableProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const { data: courses, isLoading } = useQuery({
    queryKey: [
      "department-courses-approvals",
      deptInfo?.name,
      appliedFilters?.semesterId,
      appliedFilters?.cycle,
    ],
    queryFn: async () => {
      if (!deptInfo?.name || !appliedFilters?.semesterId) return [];

      const res = await axios.get<BaseResponse<CourseResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/branch`,
        {
          params: {
            name: deptInfo.name,
            semesterId: appliedFilters.semesterId,
            ...(appliedFilters.cycle ? { cycle: appliedFilters.cycle } : {}),
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success" && res.data.data) return res.data.data;
      return [];
    },
    enabled: !!deptInfo?.name && !!appliedFilters?.semesterId,
  });

  const handleBulkSubmit = async () => {
    if (!appliedFilters?.semesterId || !deptInfo?.name) return;

    setIsSubmitting(true);
    try {
      const res = await axios.post<BaseResponse<{ count: number }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/bulk-submit`,
        {
          semesterId: appliedFilters.semesterId,
          departmentName: deptInfo.name,
          ...(appliedFilters.cycle ? { cycle: appliedFilters.cycle } : {}),
        },
        { withCredentials: true }
      );

      if (res.data.status === "success") {
        toast.success(res.data.message);
        queryClient.invalidateQueries({
          queryKey: ["department-courses-approvals"],
        });
      } else {
        toast.error("Failed to submit courses");
      }
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message
          : "An error occurred during submission";
      toast.error(message || "An error occurred during submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!appliedFilters) {
    return (
      <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
        Please select an Academic Term and Semester to view courses to submit.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center">Loading courses...</div>;
  }

  const courseList = courses || [];

  const allCoursesMapped =
    courseList.length > 0 && courseList.every((c) => c.isFullyMapped);

  const disableSubmit =
    courseList.length === 0 ||
    !allCoursesMapped ||
    courseList.every(
      (c) => c.approvalStatus === "PENDING" || c.approvalStatus === "APPROVED"
    );

  const columns: ColumnDef<CourseResponseDTO>[] = [
    {
      accessorKey: "code",
      header: "Code",
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "courseMode",
      header: "Mode",
    },
    {
      accessorKey: "courseType",
      header: "Type",
    },
    {
      accessorKey: "totalCredits",
      header: "Credits",
    },
    {
      accessorKey: "isFullyMapped",
      header: "Mapping",
      cell: ({ row }) => {
        const isFullyMapped = row.getValue("isFullyMapped") as boolean;
        const isPartiallyMapped = row.original.isPartiallyMapped as boolean;

        if (isFullyMapped) return <Badge variant="outline">Fully Mapped</Badge>;
        if (isPartiallyMapped)
          return <Badge variant="secondary">Partially Mapped</Badge>;
        return <Badge variant="destructive">Unmapped</Badge>;
      },
    },
    {
      accessorKey: "approvalStatus",
      header: "Status",
      cell: ({ row }) => {
        const course = row.original;
        const status = course.approvalStatus as string;

        let variant: "default" | "secondary" | "destructive" | "outline" =
          "default";
        if (status === "APPROVED") variant = "default";
        if (status === "PENDING") variant = "secondary";
        if (status === "DRAFT") variant = "outline";
        if (status === "NEEDS_REVISION") variant = "destructive";

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={variant}>{status || "DRAFT"}</Badge>

            {status === "PENDING" && (
              <div className="text-muted-foreground mt-1 flex gap-2 text-xs">
                <span
                  className={course.hasAdminApproved ? "text-green-600" : ""}
                >
                  Admin: {course.hasAdminApproved ? "✓" : "Pending"}
                </span>
                <span className={course.hasCoeApproved ? "text-green-600" : ""}>
                  COE: {course.hasCoeApproved ? "✓" : "Pending"}
                </span>
              </div>
            )}

            {status === "NEEDS_REVISION" && (
              <div className="text-destructive mt-1 flex flex-col gap-1 text-xs">
                {course.adminNotes && (
                  <span
                    title={course.adminNotes}
                    className="cursor-help underline decoration-dotted"
                  >
                    Admin Feedback
                  </span>
                )}
                {course.coeNotes && (
                  <span
                    title={course.coeNotes}
                    className="cursor-help underline decoration-dotted"
                  >
                    COE Feedback
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Semester Courses</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div tabIndex={0}>
                <Button
                  onClick={() => setIsAlertOpen(true)}
                  disabled={disableSubmit || isSubmitting}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : "Send Semester Courses for Approval"}
                </Button>
              </div>
            </TooltipTrigger>
            {!allCoursesMapped && courseList.length > 0 && (
              <TooltipContent>
                <p>
                  You must map all courses to faculty before submitting for
                  approval.
                </p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit Courses for Approval?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to submit all these courses to Admin/COE
                for approval? Once submitted, they will be locked from further
                edits by your department.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkSubmit}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {courseList.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No courses mapped for this semester.
        </div>
      ) : (
        <DataTable columns={columns} data={courseList} />
      )}
    </div>
  );
};
