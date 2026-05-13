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
  useAttendanceWindows,
  useBulkFreezeAttendanceWindows,
  useFacultySections,
  useFreezeAssignment,
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

const formatFrozenAt = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
};

export const AttendanceWindowsView = () => {
  const { data: termsData } = useAcademicTerms({ status: "ACTIVE" });
  const terms = termsData ?? [];

  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(EMPTY_FILTERS);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

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
  };

  const {
    data: windows = [],
    isLoading,
    isError,
    error,
  } = useAttendanceWindows(windowsFilters, windowsQueryEnabled);

  const sectionsEnabled = Boolean(
    draftFilters.academicTermId && draftFilters.semesterId
  );
  const {
    data: sections = [],
    isLoading: sectionsLoading,
    isError: sectionsError,
  } = useFacultySections(draftFilters.semesterId, sectionsEnabled);

  const { mutate: bulkFreeze, isPending: isBulkFreezing } =
    useBulkFreezeAttendanceWindows();
  const { mutate: freezeAssignment, isPending: isRowMutating } =
    useFreezeAssignment();

  const filteredWindows = useMemo(() => {
    let result = appliedFilters.sectionId
      ? windows.filter((row) => row.sectionId === appliedFilters.sectionId)
      : windows;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (row) =>
          row.courseCode.toLowerCase().includes(q) ||
          row.courseName.toLowerCase().includes(q) ||
          row.sectionName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [windows, appliedFilters.sectionId, debouncedSearch]);

  const groupedWindows = useMemo(() => {
    const groups = new Map<string, AttendanceWindowRow[]>();
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

  const isMutating = isBulkFreezing;

  const filterFields = useMemo<FilterFieldConfig<FilterState>[]>(() => {
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
        key: "sectionId",
        label: "Section",
        type: "select",
        placeholder: sectionsLoading
          ? "Loading sections..."
          : sectionsError
            ? "Failed to load sections"
            : draftFilters.semesterId
              ? "Select section"
              : "Select semester first",
        options: sections.map((s) => ({ label: s.name, value: s.id })),
      },
    ];
  }, [
    draftFilters.academicTermId,
    semesterOptions,
    terms,
    sections,
    sectionsLoading,
    sectionsError,
  ]);

  const applyFilters = () => {
    if (!draftFilters.academicTermId || !draftFilters.semesterId) {
      return;
    }
    setAppliedFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Attendance Windows
        </h3>
        <p className="text-muted-foreground text-sm">
          Freeze your attendance windows to prevent further edits. Only
          HOD/Admin can reopen frozen windows.
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
            placeholder="Search by course code, name, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <div className="flex flex-wrap items-center gap-2 md:col-span-2 md:justify-end">
            <Button
              onClick={() =>
                bulkFreeze({
                  academicTermId: appliedFilters.academicTermId,
                  semesterId: appliedFilters.semesterId,
                  ...(appliedFilters.sectionId
                    ? { sectionId: appliedFilters.sectionId }
                    : {}),
                })
              }
              disabled={
                isMutating ||
                !windowsQueryEnabled ||
                filteredWindows.length === 0
              }
            >
              {isBulkFreezing
                ? "Freezing..."
                : `Freeze Filtered (${filteredWindows.length})`}
            </Button>
            <FilterActions onApply={applyFilters} onReset={resetFilters} />
          </div>
        </div>
      </FilterPanel>

      {!windowsQueryEnabled ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Select Academic Term and Semester, then apply filters to load your
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
            groupedWindows.map(([sectionName, rows]) => (
              <div
                key={sectionName}
                className="overflow-hidden rounded-lg border"
              >
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 hover:bg-transparent">
                      <TableHead
                        colSpan={4}
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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={`${sectionName}-${row.courseAssignmentId}`}
                      >
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
                          {getStatusBadge(row)}
                          {row.freeze.frozenAt ? (
                            <div className="text-muted-foreground mt-1 whitespace-nowrap text-xs">
                              {row.freeze.frozenBy.frozenByDisplay
                                ? `${row.freeze.frozenBy.frozenByDisplay} \u2022 ${formatFrozenAt(row.freeze.frozenAt)}`
                                : formatFrozenAt(row.freeze.frozenAt)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={
                              row.freeze.displayState === "OPEN"
                                ? "default"
                                : "outline"
                            }
                            disabled={
                              row.freeze.displayState !== "OPEN" ||
                              isRowMutating
                            }
                            onClick={() => {
                              freezeAssignment(row.courseAssignmentId);
                            }}
                          >
                            {row.freeze.displayState === "OPEN"
                              ? "Freeze"
                              : "Frozen"}
                          </Button>
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
