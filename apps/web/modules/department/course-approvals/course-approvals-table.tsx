"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@webcampus/ui/components/accordion";
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {detailCourse?.code} — {detailCourse?.name}
            </DialogTitle>
          </DialogHeader>
          {detailCourse && (
            <CourseDetailContent
              courseId={detailCourse.id}
              course={detailCourse}
              semesterId={detailCourse.semesterId}
              academicYear={appliedFilters?.academicYear ?? ""}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface MappingInfo {
  id: string;
  sectionId: string | null;
  sectionName: string | null;
  assignmentType: string;
  facultyId: string;
  facultyName: string | null;
  batchName?: string | null;
  electiveBatchId?: string | null;
  electiveBatchName?: string | null;
}

interface CoordinatorInfo {
  id: string;
  facultyId: string;
  faculty: { name?: string; user?: { name: string } };
}

const CourseDetailContent = ({
  courseId,
  course,
  semesterId,
  academicYear,
}: {
  courseId: string;
  course: CourseResponseDTO;
  semesterId: string;
  academicYear: string;
}) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: mappings, isLoading: loadingMappings } = useQuery({
    queryKey: ["course-mapping-detail", courseId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<MappingInfo[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/by-course`,
        {
          params: { courseId, semesterId, academicYear },
          withCredentials: true,
        }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!courseId && !!semesterId && !!academicYear,
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
    <div className="space-y-4 py-2">
      {/* ALWAYS VISIBLE HEADER */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{course.courseMode}</Badge>
          <Badge variant="outline">{course.courseType}</Badge>
          {course.cycle && course.cycle !== "NONE" && (
            <Badge variant="outline">Cycle: {course.cycle}</Badge>
          )}
          <Badge variant="outline" className="bg-primary/5 font-semibold">
            Total Credits: {course.totalCredits}
          </Badge>
        </div>
        <Badge
          variant={
            course.approvalStatus === "APPROVED" ? "default" : "secondary"
          }
        >
          {course.approvalStatus || "DRAFT"}
        </Badge>
      </div>

      <Accordion
        type="multiple"
        defaultValue={["config", "mapping"]}
        className="w-full"
      >
        {/* ACCORDION 1: CONFIGURATION */}
        <AccordionItem value="config">
          <AccordionTrigger className="text-muted-foreground text-sm font-semibold uppercase tracking-wider hover:no-underline">
            Course Configuration
          </AccordionTrigger>
          <AccordionContent className="pb-2 pt-4">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              {/* L-T-P-S */}
              <div>
                <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
                  L-T-P-S Credits
                </h4>
                <div className="overflow-hidden rounded-md border">
                  <Table className="text-xs">
                    <TableBody>
                      <TableRow>
                        <TableCell className="bg-muted/20 py-2 font-medium">
                          Lecture
                        </TableCell>
                        <TableCell className="py-2">
                          {course.lectureCredits}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="bg-muted/20 py-2 font-medium">
                          Tutorial
                        </TableCell>
                        <TableCell className="py-2">
                          {course.tutorialCredits}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="bg-muted/20 py-2 font-medium">
                          Practical
                        </TableCell>
                        <TableCell className="py-2">
                          {course.practicalCredits}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="bg-muted/20 py-2 font-medium">
                          Skill
                        </TableCell>
                        <TableCell className="py-2">
                          {course.skillCredits}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* NEW ASSESSMENT METRICS GRID */}
              <div>
                <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
                  Assessment Metrics
                </h4>
                <div className="overflow-hidden rounded-md border p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="text-muted-foreground font-medium">
                      SEE:
                    </div>
                    <div>
                      {course.seeMaxMarks} (Min: {course.seeEligibility}%)
                    </div>

                    <div className="text-muted-foreground font-medium">
                      CIE:
                    </div>
                    <div>
                      {course.theoryMaxExams} Exams | {course.cieMaxMarks} (Min:{" "}
                      {course.cieEligibility}%)
                    </div>

                    <div className="text-muted-foreground font-medium">
                      Theory:
                    </div>
                    <div>
                      {course.theoryMinExams} Exams |{" "}
                      {course.theoryExamMaxMarks} (Min:{" "}
                      {course.theoryEligibility}%)
                    </div>

                    <div className="text-muted-foreground font-medium">
                      Theory Contribution to CIE:
                    </div>
                    <div>{course.theoryCieContribution}</div>

                    <div className="text-muted-foreground font-medium">
                      AAT:
                    </div>
                    <div>
                      {course.aatMaxMarks} (Min: {course.aatEligibility}%)
                    </div>

                    <div className="text-muted-foreground font-medium">
                      Lab:
                    </div>
                    <div>
                      {course.labMaxMarks > 0 ? 1 : 0} Sessions |{" "}
                      {course.labMaxMarks} (Min: {course.labEligibility}%)
                    </div>

                    <div className="text-muted-foreground mt-1 border-t pt-2 font-medium">
                      Cumulative Max:
                    </div>
                    <div className="mt-1 border-t pt-2">
                      {(course.cieMaxMarks || 0) + (course.seeMaxMarks || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ACCORDION 2: MAPPINGS */}
        <AccordionItem value="mapping">
          <AccordionTrigger className="text-muted-foreground text-sm font-semibold uppercase tracking-wider hover:no-underline">
            Course Mapping & Coordinators
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-2 pt-4">
            <div>
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                Faculty Mapping
              </h4>
              {loadingMappings ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading
                  mappings...
                </div>
              ) : theoryMappings.length === 0 && labMappings.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">
                  No faculty mapped.
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table className="text-sm">
                    <TableBody>
                      {theoryMappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="bg-muted/10 w-1/2 font-medium">
                            {m.sectionName
                              ? `Section ${m.sectionName}`
                              : `Batch ${m.electiveBatchName}`}{" "}
                            (Theory)
                          </TableCell>
                          <TableCell>{m.facultyName}</TableCell>
                        </TableRow>
                      ))}
                      {labMappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="bg-muted/10 w-1/2 font-medium">
                            Section {m.sectionName} Lab {m.batchName}
                          </TableCell>
                          <TableCell>{m.facultyName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                Assigned Coordinators
              </h4>
              {loadingCoords ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading
                  coordinators...
                </div>
              ) : coordinators && coordinators.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {coordinators.map((c) => (
                    <Badge key={c.id} variant="secondary" className="px-3 py-1">
                      {c.faculty?.user?.name ?? c.faculty?.name ?? "Unknown"}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  No coordinators appointed.
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
