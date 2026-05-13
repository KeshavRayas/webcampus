"use client";

import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Switch } from "@webcampus/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useMemo, useState } from "react";
import {
  AttendanceFreezeFilters,
  FreezeStateRow,
  useAttendanceFreezeData,
  useToggleAttendanceFreeze,
} from "./use-attendance-freeze";

type AttendanceFreezeFilterState = {
  academicTermId: string;
  semesterId: string;
  departmentId: string;
};

const EMPTY_FILTERS: AttendanceFreezeFilterState = {
  academicTermId: "",
  semesterId: "",
  departmentId: "",
};

export const AttendanceFreezeView = () => {
  const { data: termsData } = useAcademicTerms();
  const { data: departmentsData } = useDepartments();
  const terms = termsData ?? [];
  const departments = departmentsData ?? [];

  const [draftFilters, setDraftFilters] =
    useState<AttendanceFreezeFilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AttendanceFreezeFilterState>(EMPTY_FILTERS);

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.academicTermId
  );
  const semesterOptions = selectedDraftTerm?.Semester ?? [];

  const selectedAppliedTerm = terms.find(
    (term) => term.id === appliedFilters.academicTermId
  );
  const selectedAppliedSemesters = selectedAppliedTerm?.Semester ?? [];
  const isAppliedFirstYearUG = useMemo(() => {
    const semester = selectedAppliedSemesters.find(
      (s) => s.id === appliedFilters.semesterId
    );
    return (
      semester?.programType === "UG" &&
      (semester.semesterNumber === 1 || semester.semesterNumber === 2)
    );
  }, [selectedAppliedSemesters, appliedFilters.semesterId]);

  const dataQueryEnabled =
    appliedFilters.academicTermId.length > 0 &&
    appliedFilters.semesterId.length > 0;

  const dataFilters: AttendanceFreezeFilters = {
    academicYearId: appliedFilters.academicTermId,
    semesterId: appliedFilters.semesterId,
    ...(!isAppliedFirstYearUG && appliedFilters.departmentId
      ? { departmentId: appliedFilters.departmentId }
      : {}),
  };

  const { data: freezeData = [], isLoading } = useAttendanceFreezeData(
    dataFilters,
    dataQueryEnabled
  );

  const toggleMutation = useToggleAttendanceFreeze();

  const filterFields: FilterFieldConfig<AttendanceFreezeFilterState>[] =
    useMemo(() => {
      const fields: FilterFieldConfig<AttendanceFreezeFilterState>[] = [
        {
          key: "academicTermId",
          label: "Academic Term",
          type: "select",
          placeholder: "Select term",
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
          placeholder: draftFilters.academicTermId
            ? "Select semester"
            : "Select term first",
          hideAllOption: true,
          options: semesterOptions.map((semester) => ({
            label: `${semester.programType} - Semester ${semester.semesterNumber}`,
            value: semester.id,
          })),
        },
      ];

      if (draftFilters.academicTermId && draftFilters.semesterId) {
        if (!isAppliedFirstYearUG) {
          fields.push({
            key: "departmentId",
            label: "Department",
            type: "select",
            allOptionLabel: "All departments",
            options: departments.map((dept) => ({
              label: dept.name,
              value: dept.id,
            })),
          });
        }
      }

      return fields;
    }, [
      terms,
      semesterOptions,
      departments,
      draftFilters.academicTermId,
      draftFilters.semesterId,
      isAppliedFirstYearUG,
    ]);

  const handleFilterChange = (
    key: keyof AttendanceFreezeFilterState,
    value: string
  ) => {
    setDraftFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "academicTermId") {
        next.semesterId = "";
        next.departmentId = "";
      }
      if (key === "semesterId") {
        next.departmentId = "";
      }
      return next;
    });
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
  };

  const handleResetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const getFreezeStatusBadge = (freeze: FreezeStateRow["freeze"]) => {
    if (freeze.adminFrozen) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Locked by Admin
        </span>
      );
    }
    if (freeze.hodFrozen) {
      return (
        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
          Locked by HOD
        </span>
      );
    }
    if (freeze.facultyFrozen) {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
          Frozen by Faculty
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Editable
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Attendance Freeze</h3>
        <p className="text-muted-foreground mt-1">
          Manage attendance freeze status for course assignments. Toggle freeze
          to lock or unlock attendance data.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder<AttendanceFreezeFilterState>
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={handleFilterChange}
        />
        <FilterActions
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          isApplyDisabled={
            !draftFilters.academicTermId || !draftFilters.semesterId
          }
          isResetDisabled={
            !draftFilters.academicTermId &&
            !draftFilters.semesterId &&
            !draftFilters.departmentId
          }
        />
      </FilterPanel>

      <div>
        {!dataQueryEnabled && (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">
              Select an academic term and semester to view course assignments.
            </p>
          </div>
        )}

        {dataQueryEnabled && isLoading && (
          <div className="text-muted-foreground rounded-lg border p-8 text-center">
            <p>Loading freeze data...</p>
          </div>
        )}

        {dataQueryEnabled && !isLoading && freezeData.length === 0 && (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No course assignments found.</p>
          </div>
        )}

        {dataQueryEnabled && !isLoading && freezeData.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Course Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Freeze Toggle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freezeData.map((row) => (
                  <TableRow key={row.courseAssignmentId}>
                    <TableCell className="font-medium">
                      {row.course.code}
                    </TableCell>
                    <TableCell>{row.course.name}</TableCell>
                    <TableCell>{row.course.department.name}</TableCell>
                    <TableCell>{row.faculty.user.name}</TableCell>
                    <TableCell>{getFreezeStatusBadge(row.freeze)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.freeze.isLocked}
                          onCheckedChange={() => {
                            toggleMutation.mutate({
                              courseAssignmentId: row.courseAssignmentId,
                            });
                          }}
                          disabled={toggleMutation.isPending}
                        />
                        <span className="text-muted-foreground text-sm">
                          {row.freeze.isLocked ? "Locked" : "Unlocked"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
