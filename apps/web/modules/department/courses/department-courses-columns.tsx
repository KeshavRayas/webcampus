"use client";

import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import {
  CourseResponseDTO,
  CreateCourseDTO,
  CreateCourseSchema,
} from "@webcampus/schemas/department";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import { Form } from "@webcampus/ui/components/form";
import axios, { AxiosError, AxiosResponse } from "axios";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { CourseFormFields } from "./course-form-fields";

/** Display labels for CourseMode enum */
const COURSE_MODE_LABELS: Record<string, string> = {
  INTEGRATED: "Integrated",
  NON_INTEGRATED: "Non-Integrated",
  FINAL_SUMMARY: "Final Summary",
  NCMC: "NCMC",
};

/** Display labels for CourseType enum */
const COURSE_TYPE_LABELS: Record<string, string> = {
  PC: "Professional Core",
  PE: "Professional Elective",
  OE: "Open Elective",
  NCMC: "Non-Credit Mandatory",
};

/** Row actions component with Edit and Delete dialogs */
const CourseRowActions = ({ course }: { course: CourseResponseDTO }) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isLocked =
    course.approvalStatus === "PENDING" || course.approvalStatus === "APPROVED";

  // ── Edit Form ──
  const form = useForm<CreateCourseDTO>({
    resolver: zodResolver(CreateCourseSchema),
    defaultValues: {
      code: course.code,
      name: course.name,
      courseMode: course.courseMode,
      courseType: course.courseType,
      cycle: course.cycle ?? "NONE",
      departmentName: session?.user?.name ?? "",
      semesterId: course.semesterId,
      semesterNumber: course.semesterNumber,
      lectureCredits: course.lectureCredits,
      tutorialCredits: course.tutorialCredits,
      practicalCredits: course.practicalCredits,
      skillCredits: course.skillCredits,
      seeMaxMarks: course.seeMaxMarks,
      seeMinMarks: course.seeMinMarks,
      seeWeightage: course.seeWeightage,
      maxNoOfCies: course.maxNoOfCies,
      minNoOfCies: course.minNoOfCies,
      cieMaxMarks: course.cieMaxMarks,
      cieMinMarks: course.cieMinMarks,
      cieWeightage: course.cieWeightage,
      noOfAssignments: course.noOfAssignments,
      assignmentMaxMarks: course.assignmentMaxMarks,
      labMaxMarks: course.labMaxMarks,
      labMinMarks: course.labMinMarks,
      labWeightage: course.labWeightage,
      cumulativeMaxMarks: course.cumulativeMaxMarks,
      cumulativeMinMarks: course.cumulativeMinMarks,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CreateCourseDTO) => {
      return await axios.put(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course`,
        { id: course.id, ...values },
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setEditOpen(false);
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.error || "Failed to update course");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course`,
        {
          data: { id: course.id },
          withCredentials: true,
        }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setDeleteOpen(false);
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.error || "Failed to delete course");
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => setEditOpen(true)}
            disabled={isLocked}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            disabled={isLocked}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                updateMutation.mutate(values)
              )}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>Edit Course: {course.code}</DialogTitle>
              </DialogHeader>
              <CourseFormFields form={form} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{course.code}</strong> —{" "}
              {course.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const DepartmentCoursesColumns: ColumnDef<CourseResponseDTO>[] = [
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
    cell: ({ row }) => (
      <div>
        {COURSE_MODE_LABELS[row.original.courseMode] ?? row.original.courseMode}
      </div>
    ),
  },
  {
    accessorKey: "courseType",
    header: "Type",
    cell: ({ row }) => (
      <div>
        {COURSE_TYPE_LABELS[row.original.courseType] ?? row.original.courseType}
      </div>
    ),
  },
  {
    id: "ltps",
    header: "L-T-P-S",
    cell: ({ row }) => {
      const {
        lectureCredits,
        tutorialCredits,
        practicalCredits,
        skillCredits,
      } = row.original;
      return (
        <div className="font-mono text-sm">
          {lectureCredits ?? 0}-{tutorialCredits ?? 0}-{practicalCredits ?? 0}-
          {skillCredits ?? 0}
        </div>
      );
    },
  },
  {
    accessorKey: "totalCredits",
    header: "Total Credits",
  },
  {
    id: "actions",
    cell: ({ row }) => <CourseRowActions course={row.original} />,
  },
];
