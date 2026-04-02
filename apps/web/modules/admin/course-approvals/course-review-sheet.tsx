"use client";

import { frontendEnv } from "@webcampus/common/env";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@webcampus/ui/components/sheet";
import axios, { AxiosError } from "axios";
import { useState } from "react";
import { toast } from "react-toastify";
import { GroupedCourse } from "./course-approvals-view";

interface CourseReviewSheetProps {
  group: GroupedCourse;
  onClose: () => void;
  onSuccess: () => void;
}

export const CourseReviewSheet = ({
  group,
  onClose,
  onSuccess,
}: CourseReviewSheetProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/approve`,
        {
          semesterId: group.semesterId,
          departmentName: group.departmentName,
          cycle: group.cycle,
        },
        { withCredentials: true }
      );

      if (res.data.status === "success") {
        toast.success(res.data.message);
        onSuccess();
      }
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        const axiosError = error as AxiosError<{ message: string }>;
        toast.error(
          axiosError.response?.data?.message || "Failed to approve courses"
        );
      } else {
        toast.error("Failed to approve courses");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      toast.error("Please provide revision notes");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/request-revision`,
        {
          semesterId: group.semesterId,
          departmentName: group.departmentName,
          cycle: group.cycle,
          reviewerNotes: revisionNotes,
        },
        { withCredentials: true }
      );

      if (res.data.status === "success") {
        toast.success(res.data.message);
        onSuccess();
      }
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        const axiosError = error as AxiosError<{ message: string }>;
        toast.error(
          axiosError.response?.data?.message || "Failed to request revision"
        );
      } else {
        toast.error("Failed to request revision");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-6">
          <SheetTitle className="text-xl">Review Submission</SheetTitle>
          <SheetDescription asChild>
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-foreground font-semibold">
                {group.departmentName}
              </span>
              <span>
                Semester: {group.semester?.semesterNumber || "N/A"}
                {group.cycle !== "NONE" && ` • Cycle: ${group.cycle}`}
              </span>
              <span>Total Courses: {group.courseCount}</span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {group.courses.map((course) => (
            <div
              key={course.id}
              className="bg-card hover:bg-accent/5 rounded-md border p-4 shadow-sm transition-colors"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium leading-tight">
                    {course.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">{course.code}</p>
                </div>
                <Badge variant="outline">{course.courseType}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Credits
                  </span>
                  <span className="font-medium">{course.totalCredits}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Mode
                  </span>
                  <span className="font-medium capitalize">
                    {course.courseMode.toLowerCase().replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SheetFooter className="bg-muted/20 flex-col gap-4 border-t p-6 sm:flex-col">
          {showRevisionInput ? (
            <div className="flex w-full flex-col gap-3">
              <textarea
                placeholder="Explain why revisions are needed..."
                className="border-input ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={revisionNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setRevisionNotes(e.target.value)
                }
              />
              <div className="flex w-full justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowRevisionInput(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRequestRevision}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Send Revision Request"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-full justify-between gap-2">
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10 flex-1"
                onClick={() => setShowRevisionInput(true)}
              >
                Needs Revision
              </Button>
              <Button
                className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Approving..." : "Approve All Courses"}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
