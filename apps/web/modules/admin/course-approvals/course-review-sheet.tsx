"use client";

import { frontendEnv } from "@webcampus/common/env";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import axios, { AxiosError } from "axios";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  getApprovalBadgeConfig,
  isSubmissionApproved,
} from "./course-approval-status";
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
  const isApproved = isSubmissionApproved(group.approvalStatus);
  const groupStatusBadge = getApprovalBadgeConfig({
    approvalStatus: group.approvalStatus,
    hasAdminApproved: group.hasAdminApproved,
    hasCoeApproved: group.hasCoeApproved,
  });

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/approve`,
        {
          semesterId: group.semesterId,
          departmentId: group.departmentId,
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
          departmentId: group.departmentId,
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
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            Review Submission
            <Badge
              variant={groupStatusBadge.variant}
              className={groupStatusBadge.className}
            >
              {groupStatusBadge.label}
            </Badge>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-1">
              <span className="text-foreground font-semibold">
                {group.departmentName}
              </span>
              <span>
                Semester: {group.semester?.semesterNumber || "N/A"}
                {group.cycle !== "NONE" && ` • Cycle: ${group.cycle}`}
              </span>
              <span>Total Courses: {group.courseCount}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto py-4">
          {group.courses.map((course) => {
            const courseStatusBadge = getApprovalBadgeConfig({
              approvalStatus: course.approvalStatus,
              hasAdminApproved: course.hasAdminApproved,
              hasCoeApproved: course.hasCoeApproved,
            });

            return (
              <div
                key={course.id}
                className="bg-card hover:bg-accent/5 rounded-md border p-4 shadow-sm transition-colors"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium leading-tight">
                      {course.name}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {course.code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{course.courseType}</Badge>
                    <Badge
                      variant={courseStatusBadge.variant}
                      className={courseStatusBadge.className}
                    >
                      {courseStatusBadge.label}
                    </Badge>
                  </div>
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
            );
          })}
        </div>

        <DialogFooter className="flex-col gap-4 border-t pt-4 sm:flex-col">
          {showRevisionInput && !isApproved ? (
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
                  disabled={isSubmitting || isApproved}
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
                disabled={isApproved || isSubmitting}
              >
                Needs Revision
              </Button>
              <Button
                className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleApprove}
                disabled={isApproved || isSubmitting}
              >
                {isApproved
                  ? "Already Approved"
                  : isSubmitting
                    ? "Approving..."
                    : "Approve All Courses"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
