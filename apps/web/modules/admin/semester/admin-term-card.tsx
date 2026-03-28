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
import { ChevronDown, ChevronUp, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminSemesterConfigForm } from "./admin-semester-config-form";
import {
  useDeleteAcademicTerm,
  useUpdateAcademicTerm,
} from "./use-academic-term";

export const AdminTermCard = ({ term }: { term: AcademicTermResponseType }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutate: deleteTerm, isPending: isDeleting } = useDeleteAcademicTerm();
  const { mutate: updateTerm, isPending: isUpdating } = useUpdateAcademicTerm();
  const lifecycleStatus = term.status ?? (term.isCurrent ? "ACTIVE" : "INACTIVE");
  const disableManualInactive =
    (lifecycleStatus === "ACTIVE" || lifecycleStatus === "ARCHIVED") &&
    term.isCurrent;

  const toggleIsCurrent = () => {
    if (disableManualInactive) {
      return;
    }

    updateTerm({
      id: term.id,
      data: { type: term.type, year: term.year, isCurrent: !term.isCurrent },
    });
  };

  const handleDelete = () => {
    deleteTerm(term.id);
    setIsDeleteDialogOpen(false);
  };

  // Compute active formats
  const groupedSemesters: Record<string, number[]> = {};
  if (term.Semester) {
    term.Semester.forEach((sem) => {
      const list = groupedSemesters[sem.programType] ?? [];
      list.push(sem.semesterNumber);
      groupedSemesters[sem.programType] = list;
    });
  }

  const activeSummaries: string[] = [];
  const ugSems = groupedSemesters["UG"] || [];
  if (ugSems.length > 0) {
    activeSummaries.push(
      `UG (Sems: ${ugSems.sort((a, b) => a - b).join(", ")})`
    );
  }
  const pgSems = groupedSemesters["PG"] || [];
  if (pgSems.length > 0) {
    activeSummaries.push(
      `PG (Sems: ${pgSems.sort((a, b) => a - b).join(", ")})`
    );
  }
  const activeSummaryString =
    activeSummaries.length > 0
      ? `Configured: ${activeSummaries.join(" | ")}`
      : "No nested configurations yet.";

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
            <CardDescription className="mt-1">
              {activeSummaryString}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={term.isCurrent ? "secondary" : "default"}
              size="sm"
              onClick={toggleIsCurrent}
              disabled={isUpdating || disableManualInactive}
            >
              <Power className="mr-1 hidden h-4 w-4 md:mr-2 md:inline-block" />
              <span className="hidden md:inline-block">
                {term.isCurrent ? "Set Inactive" : "Set Active"}
              </span>
              <span className="md:hidden">
                <Power className="h-4 w-4" />
              </span>
            </Button>
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
