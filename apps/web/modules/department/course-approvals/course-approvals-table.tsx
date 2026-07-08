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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@webcampus/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@webcampus/ui/components/tooltip";
import axios, { AxiosError } from "axios";
import { Eye, Loader2 } from "lucide-react";
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
  const [detailCourse, setDetailCourse] = useState<CourseResponseDTO | null>(
    null
  );

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

  const allHaveCoordinators =
    courseList.length > 0 &&
    courseList.every((c) => (c.coordinatorCount ?? 0) > 0);

  const disableSubmit =
    courseList.length === 0 ||
    !allCoursesMapped ||
    !allHaveCoordinators ||
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
        const approvedByRole = (course.approvedByRole || "").toLowerCase();
        const approvedByText =
          approvedByRole === "admin"
            ? "Admin"
            : course.approvedByUsername || course.approvedByDisplay || "COE";
        const revisionByRole = (
          course.revisionRequestedByRole || ""
        ).toLowerCase();
        const revisionByText = revisionByRole === "admin" ? "Admin" : "COE";

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
              <div className="text-muted-foreground mt-1 text-xs">
                Awaiting Admin or COE approval
              </div>
            )}

            {status === "APPROVED" && (
              <div className="text-muted-foreground mt-1 text-xs">
                Approved by {approvedByText}
              </div>
            )}

            {status === "NEEDS_REVISION" && (
              <div className="text-destructive mt-1 flex flex-col gap-1 text-xs">
                {course.revisionNotes && (
                  <span
                    title={course.revisionNotes}
                    className="cursor-help underline decoration-dotted"
                  >
                    {revisionByText} Feedback
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "viewDetails",
      header: "",
      cell: ({ row }) => {
        const course = row.original;
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDetailCourse(course)}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View details</span>
          </Button>
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
            {courseList.length > 0 &&
              (!allCoursesMapped || !allHaveCoordinators) && (
                <TooltipContent>
                  <p>
                    {!allCoursesMapped
                      ? "All courses must be fully mapped to faculty before submitting for approval."
                      : "Every course must have at least one coordinator appointed before submitting."}
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

      <Dialog
        open={!!detailCourse}
        onOpenChange={(open) => {
          if (!open) setDetailCourse(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailCourse?.code} — {detailCourse?.name}
            </DialogTitle>
          </DialogHeader>
          {detailCourse && (
            <CourseDetailContent
              courseId={detailCourse.id}
              course={detailCourse}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface MappingInfo {
  sectionId: string;
  sectionName: string;
  assignmentType: string;
  facultyId: string;
  facultyName: string;
  batchName?: string;
}

interface CoordinatorInfo {
  id: string;
  facultyId: string;
  faculty: { name: string };
}

const CourseDetailContent = ({
  courseId,
  course,
}: {
  courseId: string;
  course: CourseResponseDTO;
}) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: mappings, isLoading: loadingMappings } = useQuery({
    queryKey: ["course-mapping-detail", courseId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<MappingInfo[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/by-course`,
        { params: { courseId }, withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!courseId,
  });

  const { data: coordinators, isLoading: loadingCoords } = useQuery({
    queryKey: ["course-coordinators-detail", courseId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CoordinatorInfo[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/${courseId}/coordinators`,
        { withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!courseId,
  });

  const theoryMappings = (mappings ?? []).filter(
    (m) => m.assignmentType === "THEORY"
  );
  const labMappings = (mappings ?? []).filter(
    (m) => m.assignmentType === "LAB"
  );

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          Course Info
        </h4>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Mode</TableCell>
              <TableCell>{course.courseMode}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Type</TableCell>
              <TableCell>{course.courseType}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Cycle</TableCell>
              <TableCell>{course.cycle || "N/A"}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Total Credits</TableCell>
              <TableCell>{course.totalCredits}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          L-T-P-S Credits
        </h4>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Lecture</TableCell>
              <TableCell>{course.lectureCredits}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Tutorial</TableCell>
              <TableCell>{course.tutorialCredits}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Practical</TableCell>
              <TableCell>{course.practicalCredits}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Skill</TableCell>
              <TableCell>{course.skillCredits}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          SEE (Semester End Exam)
        </h4>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Max Marks</TableCell>
              <TableCell>{course.seeMaxMarks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Min Marks</TableCell>
              <TableCell>{course.seeMinMarks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Weightage</TableCell>
              <TableCell>{course.seeWeightage}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          CIE (Continuous Internal)
        </h4>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Max CIEs</TableCell>
              <TableCell>{course.maxNoOfCies}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Min CIEs</TableCell>
              <TableCell>{course.minNoOfCies}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Max Marks</TableCell>
              <TableCell>{course.cieMaxMarks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Min Marks</TableCell>
              <TableCell>{course.cieMinMarks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Weightage</TableCell>
              <TableCell>{course.cieWeightage}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          Lab
        </h4>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Max Marks</TableCell>
              <TableCell>{course.labMaxMarks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Min Marks</TableCell>
              <TableCell>{course.labMinMarks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Weightage</TableCell>
              <TableCell>{course.labWeightage}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          Assignments
        </h4>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium"># Assignments</TableCell>
              <TableCell>{course.noOfAssignments}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Max Marks</TableCell>
              <TableCell>{course.assignmentMaxMarks}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          Cumulative (SEE + CIE)
        </h4>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Max Marks</TableCell>
              <TableCell>{course.cumulativeMaxMarks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Min Marks</TableCell>
              <TableCell>{course.cumulativeMinMarks}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          Faculty Mapping
        </h4>
        {loadingMappings ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading mappings...
          </div>
        ) : theoryMappings.length === 0 && labMappings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No faculty mapped.</p>
        ) : (
          <Table>
            <TableBody>
              {theoryMappings.map((m) => (
                <TableRow key={m.sectionId + "-theory"}>
                  <TableCell className="font-medium">
                    Section {m.sectionName} (Theory)
                  </TableCell>
                  <TableCell>{m.facultyName}</TableCell>
                </TableRow>
              ))}
              {labMappings.map((m) => (
                <TableRow key={m.sectionId + m.batchName + "-lab"}>
                  <TableCell className="font-medium">
                    Section {m.sectionName} Lab {m.batchName}
                  </TableCell>
                  <TableCell>{m.facultyName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          Course Coordinators
        </h4>
        {loadingCoords ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading coordinators...
          </div>
        ) : coordinators && coordinators.length > 0 ? (
          <ul className="list-inside list-disc text-sm">
            {coordinators.map((c) => (
              <li key={c.id}>{c.faculty.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No coordinators appointed.
          </p>
        )}
      </div>

      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          Status
        </h4>
        <Badge>{course.approvalStatus || "DRAFT"}</Badge>
      </div>
    </div>
  );
};
