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
  RegistrationWindowFilters,
  RegistrationWindowRow,
  RegistrationWindowTypeValue,
  useCreateRegistrationWindow,
  useRegistrationWindows,
  useToggleRegistrationWindow,
} from "./use-registration-windows";
import { WindowCoursesDialog } from "./window-courses-dialog";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

type RegistrationWindowFilterState = {
  academicTermId: string;
  semesterId: string;
  departmentId: string;
  cycle: string;
  registrationType: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY_FILTERS: RegistrationWindowFilterState = {
  academicTermId: "",
  semesterId: "",
  departmentId: "",
  cycle: "",
  registrationType: "",
  startsAt: "",
  endsAt: "",
};

const REGISTRATION_TYPE_OPTIONS = [
  "REGULAR",
  "RE_REGISTRATION",
  "SUPPLEMENTARY",
] as const;

const REGISTRATION_TYPE_LABELS: Record<string, string> = {
  REGULAR: "Regular",
  RE_REGISTRATION: "Re-registration",
  SUPPLEMENTARY: "Supplementary",
};

const formatWindowSchedule = (
  startsAt: string | null,
  endsAt: string | null
) => {
  const start = startsAt ? new Date(startsAt).toLocaleString() : "—";
  const end = endsAt ? new Date(endsAt).toLocaleString() : "—";
  return `${start} → ${end}`;
};

export const RegistrationWindowsView = () => {
  const { data: termsData } = useAcademicTerms();
  const { data: departmentsData } = useDepartments();
  const terms = termsData ?? [];
  const departments = departmentsData ?? [];

  const [draftFilters, setDraftFilters] =
    useState<RegistrationWindowFilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<RegistrationWindowFilterState>(EMPTY_FILTERS);

  const [selectedWindow, setSelectedWindow] =
    useState<RegistrationWindowRow | null>(null);

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

  const windowsFilters: RegistrationWindowFilters = {
    academicTermId: appliedFilters.academicTermId,
    semesterId: appliedFilters.semesterId,
    ...(isAppliedFirstYearUG && appliedFilters.cycle
      ? { cycle: appliedFilters.cycle as "PHYSICS" | "CHEMISTRY" }
      : {}),
    ...(!isAppliedFirstYearUG && appliedFilters.departmentId
      ? { departmentId: appliedFilters.departmentId }
      : {}),
    ...(appliedFilters.registrationType
      ? {
          registrationType:
            appliedFilters.registrationType as RegistrationWindowTypeValue,
        }
      : {}),
  };

  const { data: windows = [], isLoading } = useRegistrationWindows(
    windowsFilters,
    windowsQueryEnabled
  );

  const { mutate: createWindow, isPending: isCreating } =
    useCreateRegistrationWindow();
  const { mutate: toggleWindow, isPending: isToggling } =
    useToggleRegistrationWindow();

  const filterFields = useMemo<
    FilterFieldConfig<RegistrationWindowFilterState>[]
  >(() => {
    const primaryFields: FilterFieldConfig<RegistrationWindowFilterState>[] = [
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
        key: "registrationType",
        label: "Registration Type",
        type: "select",
        allOptionLabel: "All types",
        options: REGISTRATION_TYPE_OPTIONS.map((type) => ({
          label: REGISTRATION_TYPE_LABELS[type],
          value: type,
        })),
      },
      {
        key: "startsAt",
        label: "New Window Starts At",
        type: "date",
      },
      {
        key: "endsAt",
        label: "New Window Ends At",
        type: "date",
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
      startsAt: "",
      endsAt: "",
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const handleCreateWindow = () => {
    if (!draftFilters.academicTermId || !draftFilters.semesterId) {
      return;
    }

    createWindow({
      academicTermId: draftFilters.academicTermId,
      semesterId: draftFilters.semesterId,
      registrationType: (draftFilters.registrationType ||
        "REGULAR") as RegistrationWindowTypeValue,
      ...(draftFilters.startsAt
        ? { startsAt: new Date(draftFilters.startsAt).toISOString() }
        : {}),
      ...(draftFilters.endsAt
        ? { endsAt: new Date(draftFilters.endsAt).toISOString() }
        : {}),
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
          Registration Windows
        </h3>
        <p className="text-muted-foreground text-sm">
          Open or close registration instances by academic term and semester.
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

              if (key === "startsAt" || key === "endsAt") {
                const next = { ...current, [key]: value };
                if (!value) {
                  return next;
                }
                const otherKey = key === "startsAt" ? "endsAt" : "startsAt";
                const picked = new Date(value).getTime();
                const other = current[otherKey];
                const invalid =
                  (key === "startsAt" &&
                    !!other &&
                    new Date(other).getTime() < picked) ||
                  (key === "endsAt" &&
                    !!other &&
                    new Date(other).getTime() > picked);
                if (invalid) {
                  next[otherKey] = "";
                }
                return next;
              }

              return { ...current, [key]: value };
            });
          }}
          className="md:grid-cols-2 xl:grid-cols-3"
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCreateWindow}
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
          Loading registration windows...
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
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {windows.map((window) => (
                <TableRow key={window.id}>
                  <TableCell className="font-medium">
                    {window.instanceName}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {REGISTRATION_TYPE_LABELS[window.registrationType] ??
                        window.registrationType}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatWindowSchedule(window.startsAt, window.endsAt)}
                  </TableCell>
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
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWindow(window)}
                    >
                      View Courses
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <WindowCoursesDialog
        open={!!selectedWindow}
        selectedWindow={selectedWindow}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWindow(null);
          }
        }}
      />
    </div>
  );
};
