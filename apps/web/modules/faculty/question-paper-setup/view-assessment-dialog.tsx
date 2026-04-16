"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { BaseResponse } from "@webcampus/types/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import axios from "axios";
import { Loader2 } from "lucide-react";

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
}

export const ViewAssessmentDialog = ({
  open,
  onOpenChange,
  assessmentId,
  courseName,
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
              <div className="bg-primary/10 text-primary rounded-lg px-4 py-2 text-lg font-semibold">
                Total Marks: {assessment.totalMarks}
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
