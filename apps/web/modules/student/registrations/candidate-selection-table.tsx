"use client";

import { Badge } from "@webcampus/ui/components/badge";
import { Checkbox } from "@webcampus/ui/components/checkbox";

export interface RegistrationCandidateRow {
  courseId: string;
  code: string;
  name: string;
  courseType: string;
  totalCredits?: number;
  semesterLabel: string;
  academicTermLabel: string;
  attemptCount: number;
  nextAttemptNumber: number;
  latestOutcome: string | null;
  offered?: boolean;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
}

interface CandidateSelectionTableProps {
  candidates: RegistrationCandidateRow[];
  selectedIds: Set<string>;
  onToggle: (courseId: string) => void;
  windowOpen: boolean;
}

export const CandidateSelectionTable = ({
  candidates,
  selectedIds,
  onToggle,
  windowOpen,
}: CandidateSelectionTableProps) => {
  const showCredits = candidates.some(
    (candidate) => candidate.totalCredits != null
  );
  const showOffered = candidates.some((candidate) => candidate.offered != null);

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="w-10 px-3 py-2"></th>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Type</th>
            {showCredits ? <th className="px-3 py-2">Credits</th> : null}
            {showOffered ? <th className="px-3 py-2">Offered</th> : null}
            <th className="px-3 py-2">Term</th>
            <th className="px-3 py-2">Attempt</th>
            <th className="px-3 py-2">Latest Outcome</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const selectable = windowOpen && candidate.eligible;
            const isSelected = selectedIds.has(candidate.courseId);
            return (
              <tr key={candidate.courseId} className="border-t align-top">
                <td className="px-3 py-2">
                  <Checkbox
                    checked={isSelected}
                    disabled={!selectable}
                    onCheckedChange={() => onToggle(candidate.courseId)}
                    aria-label={`Select ${candidate.code}`}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{candidate.code}</td>
                <td className="px-3 py-2">
                  {candidate.name}
                  {!candidate.eligible && candidate.reasons.length > 0 ? (
                    <span className="text-destructive block text-xs">
                      {candidate.reasons.join(", ")}
                    </span>
                  ) : null}
                  {candidate.eligible && candidate.warnings.length > 0 ? (
                    <span className="block text-xs text-amber-600">
                      {candidate.warnings.join(", ")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{candidate.courseType}</td>
                {showCredits ? (
                  <td className="px-3 py-2">{candidate.totalCredits ?? "—"}</td>
                ) : null}
                {showOffered ? (
                  <td className="px-3 py-2">
                    <Badge
                      variant={candidate.offered ? "default" : "secondary"}
                    >
                      {candidate.offered ? "Yes" : "No"}
                    </Badge>
                  </td>
                ) : null}
                <td className="px-3 py-2">{candidate.academicTermLabel}</td>
                <td className="px-3 py-2">
                  {candidate.attemptCount} → {candidate.nextAttemptNumber}
                </td>
                <td className="px-3 py-2">
                  {candidate.latestOutcome ?? "Pending"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
