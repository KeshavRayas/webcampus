"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  useExamRegistrationEligibility,
  useExamRegistrationHistory,
  useSubmitExamRegistration,
} from "@/modules/student/registrations/use-registrations";
import { ExamRegistrationCandidateType } from "@webcampus/schemas/student";
import { Alert, AlertDescription } from "@webcampus/ui/components/alert";
import { Button } from "@webcampus/ui/components/button";
import { useMemo, useState } from "react";
import { CandidateSelectionTable } from "./candidate-selection-table";

const toRow = (candidate: ExamRegistrationCandidateType) => ({
  courseId: candidate.courseId,
  code: candidate.code,
  name: candidate.name,
  courseType: candidate.courseType,
  semesterLabel: candidate.semesterLabel,
  academicTermLabel: candidate.academicTermLabel,
  attemptCount: candidate.attemptCount,
  nextAttemptNumber: candidate.nextAttemptNumber,
  latestOutcome: candidate.latestOutcome,
  eligible: candidate.eligible,
  reasons: candidate.reasons,
  warnings: candidate.warnings,
});

export const ExamRegistrationView = () => {
  const {
    data: eligibility,
    isLoading,
    isError,
    error,
  } = useExamRegistrationEligibility();
  const submitMutation = useSubmitExamRegistration();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const candidates = useMemo(
    () => (eligibility?.candidates ?? []).map(toRow),
    [eligibility?.candidates]
  );
  const windowOpen = eligibility?.isOpen ?? false;

  const toggle = (courseId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const submit = () => {
    submitMutation.mutate(
      { courseIds: Array.from(selectedIds) },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">
          Loading examination options...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {getApiErrorMessage(error, "Unable to load examination options")}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {!windowOpen ? (
        <Alert className="border-red-500 bg-red-100 text-red-800">
          <AlertDescription>
            The examination registration window is currently closed.
          </AlertDescription>
        </Alert>
      ) : null}

      <CandidateSelectionTable
        candidates={candidates}
        selectedIds={selectedIds}
        onToggle={toggle}
        windowOpen={windowOpen}
      />

      <div className="flex items-center justify-end gap-3">
        <span className="text-muted-foreground text-sm">
          {selectedIds.size} selected
        </span>
        <Button
          onClick={submit}
          disabled={
            !windowOpen || selectedIds.size === 0 || submitMutation.isPending
          }
        >
          {submitMutation.isPending ? "Submitting..." : "Register for Exams"}
        </Button>
      </div>

      <ExamRegistrationHistorySection />
    </section>
  );
};

export const ExamRegistrationHistorySection = () => {
  const { data: history, isLoading } = useExamRegistrationHistory();

  return (
    <div className="bg-card space-y-2 rounded-xl border p-4">
      <h3 className="text-base font-semibold">Examination History</h3>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading history...</p>
      ) : !history || history.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No examination registrations recorded yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Term</th>
              <th className="px-3 py-2">Attempt</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">SEE Marks</th>
              <th className="px-3 py-2">Registered On</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 font-medium">{item.code}</td>
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2">{item.academicTermLabel}</td>
                <td className="px-3 py-2">{item.attemptNumber}</td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2">{item.outcome ?? "Pending"}</td>
                <td className="px-3 py-2">
                  {item.seeMarks != null && item.maxSeeMarks != null
                    ? `${item.seeMarks} / ${item.maxSeeMarks}`
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {new Date(item.registeredAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
