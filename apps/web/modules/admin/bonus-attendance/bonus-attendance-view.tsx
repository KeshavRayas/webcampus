"use client";

import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { Button } from "@webcampus/ui/components/button";
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
  BonusAttendanceFilters,
  useBonusAttendanceWindows,
  useCreateBonusAttendanceWindow,
  useToggleBonusAttendanceWindow,
} from "./use-bonus-attendance";
import { WindowDaysDialog } from "./window-days-dialog";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

type BonusAttendanceFilterState = {
  academicTermId: string;
  semesterId: string;
  departmentId: string;
  cycle: string;
};

const EMPTY_FILTERS: BonusAttendanceFilterState = {
  academicTermId: "",
  semesterId: "",
  departmentId: "",
  cycle: "",
};

export const BonusAttendanceView = () => {
  const { data: termsData } = useAcademicTerms();
  const { data: departmentsData } = useDepartments();
  const terms = termsData ?? [];
  const departments = departmentsData ?? [];

  const [draftFilters, setDraftFilters] =
    useState<BonusAttendanceFilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<BonusAttendanceFilterState>(EMPTY_FILTERS);

  const [isDaysDialogOpen, setIsDaysDialogOpen] = useState(false);

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.academicTermId
  );
  const semesterOptions = selectedDraftTerm?.Semester ?? [];
  const selectedSemester = semesterOptions.find(
    (semester) => semester.id === draftFilters.semesterId
  );

  const isFirstYearUG =
    selectedSemester?.programType === "UG" &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedSemester.semesterNumber);

  const selectedAppliedTerm = terms.find(
    (term) => term.id === appliedFilters.academicTermId
  );
  const selectedAppliedSemesters = selectedAppliedTerm?.Semester ?? [];
  const selectedAppliedSemester = selectedAppliedSemesters.find(
    (semester) => semester.id === appliedFilters.semesterId
  );
  const isAppliedFirstYearUG =
    selectedAppliedSemester?.programType === "UG" &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedAppliedSemester.semesterNumber);

  const windowsQueryEnabled =
    appliedFilters.academicTermId.length > 0 &&
    appliedFilters.semesterId.length > 0;

  const windowsFilters: BonusAttendanceFilters = {
    academicTermId: appliedFilters.academicTermId,
    semesterId: appliedFilters.semesterId,
    ...(isAppliedFirstYearUG && appliedFilters.cycle
      ? { cycle: appliedFilters.cycle as "PHYSICS" | "CHEMISTRY" }
      : {}),
    ...(!isAppliedFirstYearUG && appliedFilters.departmentId
      ? { departmentId: appliedFilters.departmentId }
      : {}),
  };

  const { data: windows = [], isLoading } = useBonusAttendanceWindows(
    windowsFilters,
    windowsQueryEnabled
  );

  const { mutate: createWindow, isPending: isCreating } =
    useCreateBonusAttendanceWindow();
  const { mutate: toggleWindow, isPending: isToggling } =
    useToggleBonusAttendanceWindow();

  const filterFields = useMemo<
    FilterFieldConfig<BonusAttendanceFilterState>[]
  >(() => {
    const primaryFields: FilterFieldConfig<BonusAttendanceFilterState>[] = [
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
    ];

    if (!selectedSemester) {
      return primaryFields;
    }

    if (isFirstYearUG) {
      return [
        ...primaryFields,
        {
          key: "cycle",
          label: "Cycle (Optional)",
          type: "select",
          allOptionLabel: "All cycles",
          options: CYCLE_OPTIONS.map((cycle) => ({
            label: cycle,
            value: cycle,
          })),
        },
      ];
    }

    return [
      ...primaryFields,
      {
        key: "departmentId",
        label: "Department (Optional)",
        type: "select",
        allOptionLabel: "All departments",
        options: departments.map((department) => ({
          label: department.name,
          value: department.id,
        })),
      },
    ];
  }, [
    departments,
    draftFilters.academicTermId,
    isFirstYearUG,
    selectedSemester,
    semesterOptions,
    terms,
  ]);

  const applyFilters = () => {
    if (!draftFilters.academicTermId || !draftFilters.semesterId) {
      return;
    }

    setAppliedFilters({
      ...draftFilters,
      departmentId: isFirstYearUG ? "" : draftFilters.departmentId,
      cycle: isFirstYearUG ? draftFilters.cycle : "",
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const handleCreateWindow = (days: number) => {
    if (!draftFilters.academicTermId || !draftFilters.semesterId) {
      return;
    }

    createWindow({
      academicTermId: draftFilters.academicTermId,
      semesterId: draftFilters.semesterId,
      days,
      ...(isFirstYearUG && draftFilters.cycle
        ? { cycle: draftFilters.cycle as "PHYSICS" | "CHEMISTRY" }
        : {}),
      ...(!isFirstYearUG && draftFilters.departmentId
        ? { departmentId: draftFilters.departmentId }
        : {}),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Bonus Attendance Windows
        </h3>
        <p className="text-muted-foreground text-sm">
          Open or close bonus attendance instances by academic term and
          semester. When open, faculty can take attendance for dates up to the
          configured number of days in the future.
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
                  cycle: "",
                };
              }

              if (key === "semesterId") {
                return {
                  ...current,
                  semesterId: value,
                  departmentId: "",
                  cycle: "",
                };
              }

              return { ...current, [key]: value };
            });
          }}
          className="md:grid-cols-2 xl:grid-cols-3"
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setIsDaysDialogOpen(true)}
            disabled={
              isCreating ||
              !draftFilters.academicTermId ||
              !draftFilters.semesterId
            }
          >
            {isCreating ? "Creating..." : "Create Window"}
          </Button>
          <FilterActions onApply={applyFilters} onReset={resetFilters} />
        </div>
      </FilterPanel>

      {!windowsQueryEnabled ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Select Academic Term and Semester, then apply filters to load windows.
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Loading bonus attendance windows...
        </div>
      ) : windows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No windows found. Create a window for the selected scope.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instance Name</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {windows.map((window) => (
                <TableRow key={window.id}>
                  <TableCell className="font-medium">
                    {window.instanceName}
                  </TableCell>
                  <TableCell>{window.days} Days</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={window.isOpen}
                        onCheckedChange={(checked) => {
                          toggleWindow({ id: window.id, isOpen: checked });
                        }}
                        disabled={isToggling}
                      />
                      <span className="text-sm">
                        {window.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <WindowDaysDialog
        open={isDaysDialogOpen}
        onOpenChange={setIsDaysDialogOpen}
        onConfirm={handleCreateWindow}
        isCreating={isCreating}
      />
    </div>
  );
};
