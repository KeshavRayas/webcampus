"use client";

import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
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
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Input } from "@webcampus/ui/components/input";
import { Switch } from "@webcampus/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAttendanceWindows,
  useBulkFreezeAttendanceWindows,
  useBulkUnfreezeAttendanceWindows,
  useFreezeAssignment,
  useUnfreezeAssignment,
  type AttendanceWindowFilters,
  type AttendanceWindowRow,
} from "./use-attendance-windows";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type AttendanceWindowFilterState = {
  academicTermId: string;
  semesterId: string;
  departmentId: string;
};

const EMPTY_FILTERS: AttendanceWindowFilterState = {
  academicTermId: "",
  semesterId: "",
  departmentId: "",
};

const getStatusBadge = (row: AttendanceWindowRow) => {
  switch (row.freeze.displayState) {
    case "LOCKED_BY_ADMIN":
      return <Badge variant="destructive">Locked by Admin</Badge>;
    case "FROZEN_BY_HOD":
      return <Badge variant="secondary">Frozen by HOD</Badge>;
    case "FROZEN_BY_FACULTY":
      return <Badge variant="outline">Frozen by Faculty</Badge>;
    case "OPEN":
    default:
      return <Badge variant="default">Unfrozen</Badge>;
  }
};

export const AttendanceWindowsView = () => {
  const { data: termsData } = useAcademicTerms({ isCurrent: true });
  const { data: departmentsData } = useDepartments();
  const terms = termsData ?? [];
  const departments = departmentsData ?? [];

  const [draftFilters, setDraftFilters] =
    useState<AttendanceWindowFilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AttendanceWindowFilterState>(EMPTY_FILTERS);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmActionRef = useRef<"freeze" | "unfreeze">("freeze");
  const appliedSemesterLabelRef = useRef("");

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.academicTermId
  );
  const semesterOptions = selectedDraftTerm?.Semester ?? [];

  const windowsQueryEnabled =
    appliedFilters.academicTermId.length > 0 &&
    appliedFilters.semesterId.length > 0;

  const windowsFilters: AttendanceWindowFilters = {
    academicTermId: appliedFilters.academicTermId,
    semesterId: appliedFilters.semesterId,
    ...(appliedFilters.departmentId
      ? { departmentId: appliedFilters.departmentId }
      : {}),
  };

  const {
    data: windows = [],
    isLoading,
    isError,
    error,
  } = useAttendanceWindows(windowsFilters, windowsQueryEnabled);

  const { mutate: bulkFreeze, isPending: isFreezing } =
    useBulkFreezeAttendanceWindows();
  const { mutate: bulkUnfreeze, isPending: isUnfreezing } =
    useBulkUnfreezeAttendanceWindows();
  const { mutate: freezeAssignment, isPending: isRowMutating } =
    useFreezeAssignment();
  const { mutate: unfreezeAssignment } = useUnfreezeAssignment();

  const isRowLocked = isRowMutating;

  const filteredWindows = useMemo(() => {
    if (!debouncedSearch) return windows;
    const q = debouncedSearch.toLowerCase();
    return windows.filter(
      (row) =>
        row.department.toLowerCase().includes(q) ||
        (row.hodName && row.hodName.toLowerCase().includes(q)) ||
        row.courseCode.toLowerCase().includes(q)
    );
  }, [windows, debouncedSearch]);

  const groupedWindows = useMemo(() => {
    const groups = new Map<string, AttendanceWindowRow[]>();
    for (const row of filteredWindows) {
      const dept = row.department;
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept)!.push(row);
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, rows] of sorted) {
      rows.sort((a, b) => {
        if (a.sectionName !== b.sectionName)
          return a.sectionName.localeCompare(b.sectionName);
        if (a.assignmentType !== b.assignmentType)
          return a.assignmentType === "THEORY" ? -1 : 1;
        return (a.batchName ?? "").localeCompare(b.batchName ?? "");
      });
    }
    return sorted;
  }, [filteredWindows]);

  const handleRowFreeze = (courseAssignmentId: string) => {
    freezeAssignment(courseAssignmentId);
  };

  const handleRowUnfreeze = (courseAssignmentId: string) => {
    unfreezeAssignment(courseAssignmentId);
  };

  const isMutating = isFreezing || isUnfreezing;

  const handleBulkFreezeClick = () => {
    if (!appliedFilters.departmentId) {
      confirmActionRef.current = "freeze";
      setConfirmOpen(true);
      return;
    }
    bulkFreeze({
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
      departmentId: appliedFilters.departmentId,
    });
  };

  const handleBulkUnfreezeClick = () => {
    if (!appliedFilters.departmentId) {
      confirmActionRef.current = "unfreeze";
      setConfirmOpen(true);
      return;
    }
    bulkUnfreeze({
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
      departmentId: appliedFilters.departmentId,
    });
  };

  const confirmBulkAction = () => {
    const payload = {
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
    };
    if (confirmActionRef.current === "freeze") {
      bulkFreeze(payload);
    } else {
      bulkUnfreeze(payload);
    }
    setConfirmOpen(false);
  };

  const filterFields = useMemo<
    FilterFieldConfig<AttendanceWindowFilterState>[]
  >(() => {
    return [
      {
        key: "academicTermId",
        label: "Academic Term",
        type: "select",
        hideAllOption: true,
        options: terms.map((term) => ({
          label: `${term.type.toUpperCase()} ${term.year}`,
          value: term.id,
        })),
      },
      {
        key: "semesterId",
        label: "Semester",
        type: "select",
        hideAllOption: true,
        placeholder: draftFilters.academicTermId
          ? "Select semester"
          : "Select term first",
        options: semesterOptions.map((semester) => ({
          label: `${semester.programType} - Semester ${semester.semesterNumber}`,
          value: semester.id,
        })),
      },
      {
        key: "departmentId",
        label: "Department",
        type: "select",
        options: departments.map((department) => ({
          label: department.name,
          value: department.id,
        })),
      },
    ];
  }, [departments, draftFilters.academicTermId, semesterOptions, terms]);

  const applyFilters = () => {
    if (!draftFilters.academicTermId || !draftFilters.semesterId) {
      return;
    }
    setAppliedFilters({ ...draftFilters });
    const sem = semesterOptions.find((s) => s.id === draftFilters.semesterId);
    appliedSemesterLabelRef.current = sem
      ? `${sem.programType} - Semester ${sem.semesterNumber}`
      : "";
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    appliedSemesterLabelRef.current = "";
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Attendance Windows
        </h3>
        <p className="text-muted-foreground text-sm">
          Lock attendance updates for a department in the active term.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            setDraftFilters((current) => {
              if (key === "academicTermId") {
                return {
                  ...current,
                  academicTermId: value,
                  semesterId: "",
                  departmentId: "",
                };
              }
              if (key === "semesterId") {
                return {
                  ...current,
                  semesterId: value,
                  departmentId: "",
                };
              }
              return { ...current, [key]: value };
            });
          }}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Input
            placeholder="Search by department, HOD, or course code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <div className="flex flex-wrap items-center gap-2 md:col-span-1 md:justify-end xl:col-span-2">
            <Button
              variant="outline"
              onClick={handleBulkUnfreezeClick}
              disabled={
                isMutating ||
                !windowsQueryEnabled ||
                filteredWindows.length === 0
              }
            >
              {isUnfreezing
                ? "Unfreezing..."
                : `Unfreeze Filtered (${filteredWindows.length})`}
            </Button>
            <Button
              onClick={handleBulkFreezeClick}
              disabled={
                isMutating ||
                !windowsQueryEnabled ||
                filteredWindows.length === 0
              }
            >
              {isFreezing
                ? "Freezing..."
                : `Freeze Filtered (${filteredWindows.length})`}
            </Button>
            <FilterActions onApply={applyFilters} onReset={resetFilters} />
          </div>
        </div>
      </FilterPanel>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Institution-Wide Action</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to{" "}
              {confirmActionRef.current === "freeze" ? "freeze" : "unfreeze"}{" "}
              attendance windows for <strong>all departments</strong> in{" "}
              <strong>{appliedSemesterLabelRef.current}</strong> (
              {filteredWindows.length} rows affected). This action cannot be
              undone. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkAction}>
              Yes,{" "}
              {confirmActionRef.current === "freeze" ? "Freeze" : "Unfreeze"}{" "}
              All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!windowsQueryEnabled ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Select Academic Term and Semester, then apply filters to load
          attendance windows.
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Loading attendance windows...
        </div>
      ) : isError ? (
        <div className="text-destructive rounded-lg border p-8 text-center text-sm">
          {error instanceof Error
            ? error.message
            : "Failed to load attendance windows"}
        </div>
      ) : windows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No course assignments found for the selected scope.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedWindows.length === 0 && debouncedSearch ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              No results match your search.
            </div>
          ) : (
            groupedWindows.map(([deptName, rows]) => (
              <div key={deptName} className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 hover:bg-transparent">
                      <TableHead
                        colSpan={5}
                        className="bg-muted/60 sticky top-0 text-base font-semibold"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span>{deptName}</span>
                            {rows[0]?.hodName && (
                              <Badge
                                variant="secondary"
                                className="text-xs font-normal uppercase"
                              >
                                HOD: {rows[0].hodName}
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground text-sm font-normal">
                            {rows.length} window
                            {rows.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${deptName}-${row.courseAssignmentId}`}>
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold">
                              {row.courseCode}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {row.courseName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{row.sectionName}</div>
                          <div className="text-muted-foreground text-xs">
                            {row.assignmentType}
                            {row.batchName
                              ? ` \u2022 Batch: ${row.batchName}`
                              : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{row.facultyName}</div>
                          <div className="text-muted-foreground text-xs">
                            {row.department}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(row)}
                          {row.freeze.frozenAt ? (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {new Date(row.freeze.frozenAt).toLocaleString()}
                              {row.freeze.frozenByDisplay && (
                                <span> by {row.freeze.frozenByDisplay}</span>
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Switch
                              checked={
                                row.freeze.displayState === "LOCKED_BY_ADMIN"
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleRowFreeze(row.courseAssignmentId);
                                  return;
                                }
                                handleRowUnfreeze(row.courseAssignmentId);
                              }}
                              disabled={isRowLocked}
                            />
                            <span className="text-sm">
                              {row.freeze.displayState === "LOCKED_BY_ADMIN"
                                ? "Frozen"
                                : "Unfrozen"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
