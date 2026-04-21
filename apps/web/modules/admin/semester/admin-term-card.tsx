"use client";

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

  // Issue 5: Check if the term is archived
  const isArchived = lifecycleStatus === "ARCHIVED";

  const handleDelete = () => {
    deleteTerm(term.id);
    setIsDeleteDialogOpen(false);
  };

  // Issue 4: Compute both Configured and Active formats
  const configuredSemesters: Record<string, number[]> = {};
  const activeSemesters: Record<string, number[]> = {};

  if (term.Semester) {
    term.Semester.forEach((sem) => {
      // Group all for 'Configured'
      const configList = configuredSemesters[sem.programType] ?? [];
      configList.push(sem.semesterNumber);
      configuredSemesters[sem.programType] = configList;

      // Group only active for 'Active' (Assuming your schema uses sem.status)
      if (sem.status === "ACTIVE") {
        const activeList = activeSemesters[sem.programType] ?? [];
        activeList.push(sem.semesterNumber);
        activeSemesters[sem.programType] = activeList;
      }
    });
  }

  // Helper function to format the semester strings
  const formatSummary = (record: Record<string, number[]>) => {
    const summaries: string[] = [];
    if (record["UG"] && record["UG"].length > 0) {
      summaries.push(`UG: ${record["UG"].sort((a, b) => a - b).join(", ")}`);
    }
    if (record["PG"] && record["PG"].length > 0) {
      summaries.push(`PG: ${record["PG"].sort((a, b) => a - b).join(", ")}`);
    }
    return summaries.join(" | ");
  };

  const configuredSummaryString = formatSummary(configuredSemesters) || "None";
  const activeSummaryString = formatSummary(activeSemesters) || "None";

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
                {term.type.toUpperCase()} {term.year}
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
            {/* Issue 4: Show both configured and active statuses below each other */}
            <CardDescription className="mt-2 flex flex-col gap-1">
              <span className="text-muted-foreground">
                Configured: {configuredSummaryString}
              </span>

              {/* Highlight the active semester in Black Bold */}
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
              disabled={isArchived} // Issue 5: Disable config if archived
              title={
                isArchived ? "Archived terms cannot be configured" : undefined
              }
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
            <AdminSemesterConfigForm termId={term.id} termType={term.type} />
          </CardContent>
        )}
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Academic Term</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {term.type.toUpperCase()}{" "}
              {term.year}? This will safely drop all underlying semester
              configurations. This action cannot be undone.
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
