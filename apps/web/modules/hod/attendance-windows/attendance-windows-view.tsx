"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
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
import { useEffect, useMemo, useState } from "react";
import {
  useHODAttendanceWindows,
  useHODBulkFreezeAttendanceWindows,
  useHODBulkUnfreezeAttendanceWindows,
  useHODFreezeAssignment,
  useHODSections,
  useHODUnfreezeAssignment,
  type HODAttendanceWindowFilters,
  type HODAttendanceWindowRow,
} from "./use-attendance-windows";

type FilterState = {
  academicTermId: string;
  semesterId: string;
  sectionId: string;
};

const EMPTY_FILTERS: FilterState = {
  academicTermId: "",
  semesterId: "",
  sectionId: "",
};

const getStatusBadge = (row: HODAttendanceWindowRow) => {
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

const getFrozenMetadata = (row: HODAttendanceWindowRow) => {
  if (!row.freeze.frozenAt) return null;
  const date = new Date(row.freeze.frozenAt);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = isToday
    ? `Today ${timeStr}`
    : `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;

  const actor = row.freeze.frozenByDisplay || row.freeze.frozenByRole || "";
  return actor ? `${actor} • ${dateStr}` : dateStr;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const HODAttendanceWindowsView = () => {
  const {
    data: termsData,
    isLoading: termsLoading,
    isError: termsError,
  } = useAcademicTerms({ status: "ACTIVE" });
  const terms = termsData ?? [];

  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(EMPTY_FILTERS);
  const [resetKey, setResetKey] = useState(0);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.academicTermId
  );
  const semesterOptions = selectedDraftTerm?.Semester ?? [];

  const sectionsEnabled =
    !!draftFilters.academicTermId && !!draftFilters.semesterId;
  const {
    data: sectionsData,
    isLoading: sectionsLoading,
    isError: sectionsError,
  } = useHODSections(draftFilters.semesterId, sectionsEnabled);
  const sections = sectionsData ?? [];

  const queryEnabled =
    appliedFilters.academicTermId.length > 0 &&
    appliedFilters.semesterId.length > 0;

  const filters: HODAttendanceWindowFilters = {
    academicTermId: appliedFilters.academicTermId,
    semesterId: appliedFilters.semesterId,
    ...(appliedFilters.sectionId
      ? { sectionId: appliedFilters.sectionId }
      : {}),
  };

  const {
    data: windows = [],
    isLoading,
    isError,
    error,
  } = useHODAttendanceWindows(filters, queryEnabled);

  const { mutate: bulkFreeze, isPending: isFreezing } =
    useHODBulkFreezeAttendanceWindows();
  const { mutate: bulkUnfreeze, isPending: isUnfreezing } =
    useHODBulkUnfreezeAttendanceWindows();
  const { mutate: freezeAssignment, isPending: isRowFreezing } =
    useHODFreezeAssignment();
  const { mutate: unfreezeAssignment, isPending: isRowUnfreezing } =
    useHODUnfreezeAssignment();

  const isRowMutating = isRowFreezing || isRowUnfreezing;
  const isMutating = isFreezing || isUnfreezing;

  const filteredWindows = useMemo(() => {
    if (!debouncedSearch) return windows;
    const q = debouncedSearch.toLowerCase();
    return windows.filter(
      (row) =>
        row.courseCode.toLowerCase().includes(q) ||
        row.courseName.toLowerCase().includes(q) ||
        row.sectionName.toLowerCase().includes(q) ||
        row.facultyName.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q)
    );
  }, [windows, debouncedSearch]);

  const groupedWindows = useMemo(() => {
    const groups = new Map<string, HODAttendanceWindowRow[]>();
    for (const row of filteredWindows) {
      const section = row.sectionName;
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section)!.push(row);
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, rows] of sorted) {
      rows.sort((a, b) => {
        if (a.assignmentType !== b.assignmentType)
          return a.assignmentType === "THEORY" ? -1 : 1;
        return (a.batchName ?? "").localeCompare(b.batchName ?? "");
      });
    }
    return sorted;
  }, [filteredWindows]);

  const filterFields = useMemo<FilterFieldConfig<FilterState>[]>(
    () => [
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
        key: "sectionId",
        label: "Section",
        type: "select",
        hideAllOption: false,
        placeholder: sectionsLoading
          ? "Loading sections..."
          : sectionsError
            ? "Failed to load sections"
            : draftFilters.semesterId
              ? "Select section"
              : "Select semester first",
        options: sections.map((section) => ({
          label: section.name,
          value: section.id,
        })),
      },
    ],
    [
      draftFilters.academicTermId,
      semesterOptions,
      terms,
      sections,
      sectionsLoading,
      sectionsError,
    ]
  );

  const applyFilters = () => {
    if (!draftFilters.academicTermId || !draftFilters.semesterId) return;
    setAppliedFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setResetKey((k) => k + 1);
    setSearch("");
  };

  const handleBulkFreeze = () => {
    if (!queryEnabled || isMutating) return;
    bulkFreeze({
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
      ...(appliedFilters.sectionId
        ? { sectionId: appliedFilters.sectionId }
        : {}),
    });
  };

  const handleBulkUnfreeze = () => {
    if (!queryEnabled || isMutating) return;
    bulkUnfreeze({
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
      ...(appliedFilters.sectionId
        ? { sectionId: appliedFilters.sectionId }
        : {}),
    });
  };

  const handleRowAction = (row: HODAttendanceWindowRow) => {
    if (row.freeze.displayState === "OPEN") {
      freezeAssignment(row.courseAssignmentId);
    } else {
      unfreezeAssignment(row.courseAssignmentId);
    }
  };

  if (termsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">
            Attendance Windows
          </h3>
          <p className="text-muted-foreground text-sm">
            Loading academic terms...
          </p>
        </div>
      </div>
    );
  }

  if (termsError) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">
            Attendance Windows
          </h3>
        </div>
        <div className="text-destructive rounded-lg border p-8 text-center text-sm">
          Failed to load academic terms. Please try again later.
        </div>
      </div>
    );
  }

  if (terms.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">
            Attendance Windows
          </h3>
          <p className="text-muted-foreground text-sm">
            Manage attendance freeze windows for your department.
          </p>
        </div>
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No academic terms available.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Attendance Windows
        </h3>
        <p className="text-muted-foreground text-sm">
          Manage attendance freeze windows for your department.
        </p>
      </div>

      {semesterOptions.length === 0 && draftFilters.academicTermId && (
        <div className="text-muted-foreground rounded-lg border p-4 text-center text-sm">
          No semesters found for the selected academic term.
        </div>
      )}

      {sectionsError && draftFilters.semesterId && (
        <div className="text-destructive rounded-lg border p-4 text-center text-sm">
          Failed to load sections.
        </div>
      )}

      <FilterPanel key={resetKey}>
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
                  sectionId: "",
                };
              }
              if (key === "semesterId") {
                return { ...current, semesterId: value, sectionId: "" };
              }
              return { ...current, [key]: value };
            });
          }}
          className="md:grid-cols-3"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            placeholder="Search by course code, name, faculty, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <div className="flex flex-wrap items-center gap-2 md:col-span-2 md:justify-end">
            <Button
              variant="outline"
              onClick={handleBulkUnfreeze}
              disabled={
                isMutating || !queryEnabled || filteredWindows.length === 0
              }
            >
              {isUnfreezing
                ? "Unfreezing..."
                : `Unfreeze Filtered (${filteredWindows.length})`}
            </Button>
            <Button
              onClick={handleBulkFreeze}
              disabled={
                isMutating || !queryEnabled || filteredWindows.length === 0
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

      {!queryEnabled ? (
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
      ) : groupedWindows.length === 0 && debouncedSearch ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No results match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedWindows.map(([sectionName, rows]) => (
            <div
              key={sectionName}
              className="overflow-hidden rounded-lg border"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 hover:bg-transparent">
                    <TableHead
                      colSpan={5}
                      className="bg-muted/60 sticky top-0 text-base font-semibold"
                    >
                      <div className="flex items-center justify-between">
                        <span>{sectionName}</span>
                        <span className="text-muted-foreground text-sm font-normal">
                          {rows.length} window
                          {rows.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Section / Batch</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.courseAssignmentId}>
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
                          {row.batchName ? ` • Batch: ${row.batchName}` : ""}
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
                        {getFrozenMetadata(row) && (
                          <div className="text-muted-foreground mt-1 text-xs">
                            {getFrozenMetadata(row)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Switch
                            checked={row.freeze.displayState !== "OPEN"}
                            onCheckedChange={() => handleRowAction(row)}
                            disabled={
                              row.freeze.displayState === "LOCKED_BY_ADMIN" ||
                              isRowMutating
                            }
                          />
                          <span className="text-sm">
                            {row.freeze.displayState === "LOCKED_BY_ADMIN"
                              ? "Locked"
                              : row.freeze.displayState !== "OPEN"
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
          ))}
        </div>
      )}
    </div>
  );
};
