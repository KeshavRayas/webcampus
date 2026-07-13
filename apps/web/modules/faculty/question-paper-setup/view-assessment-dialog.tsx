"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { BaseResponse, ErrorResponse } from "@webcampus/types/api";
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
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import axios, { AxiosError } from "axios";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

interface AssessmentQuestion {
  id: string;
  part: string;
  qNumber: string;
  marks: number;
  co: string | null;
  po: string | null;
  bl: string | null;
}

interface AssessmentResponse {
  id: string;
  title: string;
  courseId: string;
  semesterId: string;
  totalMarks: number;
  questions: AssessmentQuestion[];
  course: {
    code: string;
    name: string;
  };
}

interface ViewAssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  courseName: string;
  onDelete?: () => void;
}

export const ViewAssessmentDialog = ({
  open,
  onOpenChange,
  assessmentId,
  courseName,
  onDelete,
}: ViewAssessmentDialogProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: assessment, isLoading } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AssessmentResponse>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/${assessmentId}`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return null;
    },
    enabled: !!assessmentId,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.delete<BaseResponse<null>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/${assessmentId}`,
        { withCredentials: true }
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Assessment deleted successfully");
      onDelete?.();
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to delete assessment"
      );
    },
  });

  // Group questions by part for nice rendering
  const parts =
    assessment?.questions.reduce(
      (acc, q) => {
        if (!acc[q.part]) acc[q.part] = [];
        acc[q.part]!.push(q);
        return acc;
      },
      {} as Record<string, AssessmentQuestion[]>
    ) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-7xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between border-b pb-4 pr-8">
            <div>
              <DialogTitle className="text-xl">
                {assessment?.title || "Loading..."} — {courseName}
              </DialogTitle>
              <DialogDescription>
                View Assessment configuration template.
              </DialogDescription>
            </div>
            {!isLoading && assessment && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary rounded-lg px-4 py-2 text-lg font-semibold">
                  Total Marks: {assessment.totalMarks}
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-border mx-2 h-8 w-px" />
                  <AlertDialog
                    open={deleteConfirmOpen}
                    onOpenChange={setDeleteConfirmOpen}
                  >
                    <div>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete this assessment?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the assessment and all
                            configured questions. This action cannot be undone.
                          </AlertDialogDescription>
                          <AlertDialogDescription className="font-medium text-amber-600">
                            Assessments that already contain student marks
                            cannot be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel
                            disabled={deleteMutation.isPending}
                          >
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deleteMutation.isPending}
                            onClick={(e) => {
                              e.preventDefault();
                              deleteMutation.mutate();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleteMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 size-4" />
                      )}
                      Delete Setup
                    </Button>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-24">
            <Loader2 className="text-muted-foreground size-8 animate-spin opacity-50" />
            <span className="text-muted-foreground ml-4">
              Fetching template data...
            </span>
          </div>
        ) : !assessment ? (
          <div className="text-destructive py-12 text-center">
            <p>Failed to load the assessment data.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-8">
            {Object.entries(parts).map(([partName, questions]) => (
              <div
                key={partName}
                className="bg-muted/10 rounded-xl border p-4 shadow-sm"
              >
                <h3 className="mb-4 border-b pb-3 text-lg font-semibold">
                  {partName}
                </h3>

                <div className="bg-background relative overflow-hidden rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="w-32 border-r px-4 py-3">Q#</th>
                        <th className="w-40 border-r px-4 py-3 text-center">
                          Marks
                        </th>
                        <th className="w-40 border-r px-4 py-3 text-center">
                          CO
                        </th>
                        <th className="w-40 border-r px-4 py-3 text-center">
                          PO
                        </th>
                        <th className="w-40 px-4 py-3 text-center">
                          Bloom&apos;s Level
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q) => (
                        <tr
                          key={q.id}
                          className="hover:bg-muted/30 border-b last:border-0"
                        >
                          <td className="border-r px-4 py-3 text-center font-medium">
                            {q.qNumber}
                          </td>
                          <td className="text-primary/80 border-r px-4 py-3 text-center font-semibold">
                            {q.marks}
                          </td>
                          <td className="border-r px-4 py-3 text-center">
                            {q.co || (
                              <span className="text-muted-foreground opacity-50">
                                -
                              </span>
                            )}
                          </td>
                          <td className="border-r px-4 py-3 text-center">
                            {q.po || (
                              <span className="text-muted-foreground opacity-50">
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {q.bl || (
                              <span className="text-muted-foreground opacity-50">
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
