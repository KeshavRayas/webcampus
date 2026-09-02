"use client";

import { getTermLabel } from "@webcampus/common/term-label";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminSemesterConfigForm } from "./admin-semester-config-form";
import { useDeleteAcademicTerm } from "./use-academic-term";

export const AdminTermCard = ({ term }: { term: AcademicTermResponseType }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutate: deleteTerm, isPending: isDeleting } = useDeleteAcademicTerm();
  const lifecycleStatus =
    term.status ?? (term.isCurrent ? "ACTIVE" : "INACTIVE");

  const handleDelete = () => {
    deleteTerm(term.id);
    setIsDeleteDialogOpen(false);
  };

  const groupByProgramType = (
    semesters: NonNullable<AcademicTermResponseType["Semester"]>,
    filter?: (sem: NonNullable<AcademicTermResponseType["Semester"]>[number]) => boolean
  ): Record<string, number[]> => {
    const grouped: Record<string, number[]> = {};
    for (const sem of semesters) {
      if (filter && !filter(sem)) continue;
      const list = grouped[sem.programType] ?? [];
      list.push(sem.semesterNumber);
      grouped[sem.programType] = list;
    }
    return grouped;
  };

  const formatSemesterSummary = (record: Record<string, number[]>) => {
    const summaries: string[] = [];
    if (record["UG"] && record["UG"].length > 0) {
      summaries.push(`UG: ${record["UG"].sort((a, b) => a - b).join(", ")}`);
    }
    if (record["PG"] && record["PG"].length > 0) {
      summaries.push(`PG: ${record["PG"].sort((a, b) => a - b).join(", ")}`);
    }
    return summaries.join(" | ");
  };

  const configuredSemesters = term.Semester
    ? groupByProgramType(term.Semester)
    : {};
  const activeSemesters = term.Semester
    ? groupByProgramType(term.Semester, (sem) => sem.status === "ACTIVE")
    : {};

  const configuredSummaryString = formatSemesterSummary(configuredSemesters) || "None";
  const activeSummaryString = formatSemesterSummary(activeSemesters) || "None";

  return (
    <>
      <Card
        className="mb-4 border-l-4 shadow-sm"
        style={{
          borderLeftColor:
            lifecycleStatus === "ACTIVE"
              ? "#4ade80"
              : lifecycleStatus === "ARCHIVED"
                ? "#94a3b8"
                : "#e2e8f0",
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3">
          <div>
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">
                {getTermLabel(term.type, term.year, term.parity).toUpperCase()}
              </CardTitle>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium tracking-wide ${
                  lifecycleStatus === "ACTIVE"
                    ? "bg-green-100 text-green-800"
                    : lifecycleStatus === "ARCHIVED"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {lifecycleStatus}
              </span>
            </div>
            <CardDescription className="mt-2 flex flex-col gap-1">
              <span className="text-muted-foreground">
                Configured: {configuredSummaryString}
              </span>
              <span className="font-bold text-black dark:text-white">
                Active: {activeSummaryString}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <Trash2 className="mr-1 hidden h-4 w-4 md:mr-2 md:inline-block" />
              <span className="hidden md:inline-block">Delete</span>
              <span className="md:hidden">
                <Trash2 className="h-4 w-4" />
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <span className="hidden md:inline-block">Collapse</span>{" "}
                  <ChevronUp className="h-4 w-4 md:ml-2" />
                </>
              ) : (
                <>
                  <span className="hidden md:inline-block">Configure</span>{" "}
                  <ChevronDown className="h-4 w-4 md:ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent>
            <AdminSemesterConfigForm
              termId={term.id}
              termType={term.type}
              parity={term.parity}
              year={term.year}
            />
          </CardContent>
        )}
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Academic Term</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              {getTermLabel(term.type, term.year, term.parity)}? This will
              safely drop all underlying semester configurations. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
