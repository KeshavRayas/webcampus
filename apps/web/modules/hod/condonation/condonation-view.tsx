"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useHODSections } from "@/modules/hod/attendance-windows/use-attendance-windows";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useHODApproveCondonation,
  useHODCondonationCourses,
  useHODCondonationStudents,
  type HODCondonationStudentRow,
} from "./use-condonation";

type FilterState = {
  academicTermId: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
};

const EMPTY_FILTERS: FilterState = {
  academicTermId: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
};

const getStatusBadge = (
  status: HODCondonationStudentRow["condonationStatus"]
) => {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>
      );
    case "PENDING":
      return <Badge className="bg-amber-500 hover:bg-amber-500">Pending</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
    case "NOT_REQUESTED":
    default:
      return <Badge variant="outline">Not Requested</Badge>;
  }
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const CondonationView = () => {
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

  const [approveTarget, setApproveTarget] =
    useState<HODCondonationStudentRow | null>(null);

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.academicTermId
  );
  const semesterOptions = selectedDraftTerm?.Semester ?? [];

  const coursesEnabled = !!draftFilters.semesterId;
  const {
    data: coursesData,
    isLoading: coursesLoading,
    isError: coursesError,
  } = useHODCondonationCourses(draftFilters.semesterId, coursesEnabled);
  const courses = coursesData ?? [];

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

  const appliedSearch = useMemo(() => {
    if (!queryEnabled) return "";
    return debouncedSearch;
  }, [queryEnabled, debouncedSearch]);

  const studentFilters = useMemo(
    () => ({
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
      ...(appliedFilters.courseId ? { courseId: appliedFilters.courseId } : {}),
      ...(appliedFilters.sectionId
        ? { sectionId: appliedFilters.sectionId }
        : {}),
      ...(appliedSearch ? { search: appliedSearch } : {}),
    }),
    [appliedFilters, appliedSearch]
  );

  const {
    data: students = [],
    isLoading,
    isError,
    error,
  } = useHODCondonationStudents(studentFilters, queryEnabled);

  const { mutate: approveCondonation, isPending: isApproving } =
    useHODApproveCondonation(studentFilters);

  const handleConfirmApprove = useCallback(() => {
    if (!approveTarget) return;
    approveCondonation(approveTarget.attendanceId, {
      onSuccess: () => setApproveTarget(null),
    });
  }, [approveTarget, approveCondonation]);

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
        key: "courseId",
        label: "Course",
        type: "select",
        hideAllOption: false,
        placeholder: coursesLoading
          ? "Loading courses..."
          : coursesError
            ? "Failed to load courses"
            : draftFilters.semesterId
              ? "All courses"
              : "Select semester first",
        options: courses.map((course) => ({
          label: `${course.code} - ${course.name}`,
          value: course.id,
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
              ? "All sections"
              : "Select semester first",
        options: sections.map((section) => ({
          label: section.name,
          value: section.id,
        })),
      },
    ],
    [
      draftFilters.academicTermId,
      draftFilters.semesterId,
      semesterOptions,
      terms,
      courses,
      coursesLoading,
      coursesError,
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

  if (termsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">Condonation</h3>
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
          <h3 className="text-xl font-semibold tracking-tight">Condonation</h3>
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
          <h3 className="text-xl font-semibold tracking-tight">Condonation</h3>
          <p className="text-muted-foreground text-sm">
            Manage condonation approval for students with attendance deficiency.
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
        <h3 className="text-xl font-semibold tracking-tight">Condonation</h3>
        <p className="text-muted-foreground text-sm">
          Approve condonation for students with attendance between 75% and 85%.
        </p>
      </div>

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
                  courseId: "",
                  sectionId: "",
                };
              }
              if (key === "semesterId") {
                return {
                  ...current,
                  semesterId: value,
                  courseId: "",
                  sectionId: "",
                };
              }
              return { ...current, [key]: value };
            });
          }}
          className="md:grid-cols-4"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            placeholder="Search by USN or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <div className="flex flex-wrap items-center gap-2 md:col-span-2 md:justify-end">
            <FilterActions onApply={applyFilters} onReset={resetFilters} />
          </div>
        </div>
      </FilterPanel>

      {!queryEnabled ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Select Academic Term and Semester, then apply filters to view eligible
          students.
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Loading eligible students...
        </div>
      ) : isError ? (
        <div className="text-destructive rounded-lg border p-8 text-center text-sm">
          {error instanceof Error
            ? error.message
            : "Failed to load eligible students"}
        </div>
      ) : students.length === 0 && appliedSearch ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No results match your search criteria.
        </div>
      ) : students.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No students are currently eligible for condonation.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>USN</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>Attended / Total</TableHead>
                <TableHead>Condonation</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((row) => (
                <TableRow key={row.attendanceId}>
                  <TableCell className="font-mono text-sm font-medium">
                    {row.usn}
                  </TableCell>
                  <TableCell className="text-sm">{row.name}</TableCell>
                  <TableCell>
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
                    <span
                      className={
                        row.percentage < 80
                          ? "text-destructive font-semibold"
                          : "font-semibold text-amber-500"
                      }
                    >
                      {row.percentage}%
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.present} / {row.total}
                  </TableCell>
                  <TableCell>{getStatusBadge(row.condonationStatus)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={
                        row.condonationStatus === "APPROVED" || isApproving
                      }
                      onClick={() => setApproveTarget(row)}
                    >
                      {row.condonationStatus === "APPROVED"
                        ? "Approved"
                        : "Approve"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Condonation</AlertDialogTitle>
            <AlertDialogDescription>
              Approve condonation for{" "}
              <span className="font-semibold">{approveTarget?.name}</span> (
              <span className="font-mono">{approveTarget?.usn}</span>)?
              <br />
              This will update their attendance percentage to{" "}
              <span className="font-semibold">85%</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApprove}
              disabled={isApproving}
            >
              {isApproving ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
