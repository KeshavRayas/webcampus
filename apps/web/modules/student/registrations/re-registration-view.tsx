"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  useReRegistrationEligibility,
  useReRegistrationHistory,
  useSubmitReRegistration,
} from "@/modules/student/registrations/use-registrations";
import { ReRegistrationCandidateType } from "@webcampus/schemas/student";
import { Alert, AlertDescription } from "@webcampus/ui/components/alert";
import { Button } from "@webcampus/ui/components/button";
import { useMemo, useState } from "react";
import { CandidateSelectionTable } from "./candidate-selection-table";

const toRow = (candidate: ReRegistrationCandidateType) => ({
  courseId: candidate.courseId,
  code: candidate.code,
  name: candidate.name,
  courseType: candidate.courseType,
  totalCredits: candidate.totalCredits,
  semesterLabel: candidate.semesterLabel,
  academicTermLabel: candidate.academicTermLabel,
  attemptCount: candidate.attemptCount,
  nextAttemptNumber: candidate.nextAttemptNumber,
  latestOutcome: candidate.latestOutcome,
  eligible: candidate.eligible,
  reasons: candidate.reasons,
  warnings: candidate.warnings,
});

export const ReRegistrationView = () => {
  const {
    data: eligibility,
    isLoading,
    isError,
    error,
  } = useReRegistrationEligibility();
  const submitMutation = useSubmitReRegistration();
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
          Loading re-registration options...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {getApiErrorMessage(error, "Unable to load re-registration options")}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {!windowOpen ? (
        <Alert className="border-red-500 bg-red-100 text-red-800">
          <AlertDescription>
            The re-registration window is currently closed.
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
          {submitMutation.isPending
            ? "Submitting..."
            : "Submit Re-registration"}
        </Button>
      </div>

      <ReRegistrationHistorySection />
    </section>
  );
};

export const ReRegistrationHistorySection = () => {
  const { data: history, isLoading } = useReRegistrationHistory();

  return (
    <div className="bg-card space-y-2 rounded-xl border p-4">
      <h3 className="text-base font-semibold">Re-registration History</h3>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading history...</p>
      ) : !history || history.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No re-registrations recorded yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Term</th>
              <th className="px-3 py-2">Semester</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Registered On</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, index) => (
              <tr key={`${item.courseId}-${index}`} className="border-t">
                <td className="px-3 py-2 font-medium">{item.code}</td>
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2">{item.academicTermLabel}</td>
                <td className="px-3 py-2">{item.semesterLabel}</td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2">
                  {new Date(item.registrationDate).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
