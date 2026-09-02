"use client";

import { useDepartments } from "@/lib/use-departments";
import { useSupplementaryRegistrations } from "@/modules/admin/courses/use-supplementary-admin";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";
import { useMemo, useState } from "react";
import { StudentCoursesSheet } from "./student-courses-sheet";
import {
  RegistrationTrackingFilters,
  RegistrationTrackingRow,
  useRegistrationTracking,
} from "./use-registration-tracking";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;
const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Registered", value: "REGISTERED" },
  { label: "Pending", value: "PENDING" },
] as const;

type TrackingFilterState = {
  academicTermId: string;
  semesterId: string;
  departmentId: string;
  cycle: string;
  statusFilter: string;
};

const EMPTY_FILTERS: TrackingFilterState = {
  academicTermId: "",
  semesterId: "",
  departmentId: "",
  cycle: "",
  statusFilter: "",
};

export const RegistrationTrackingView = () => {
  const { data: termsData } = useAcademicTerms();
  const { data: departmentsData } = useDepartments();
  const terms = termsData ?? [];
  const departments = departmentsData ?? [];

  const [draftFilters, setDraftFilters] =
    useState<TrackingFilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<TrackingFilterState>(EMPTY_FILTERS);

  const [selectedStudent, setSelectedStudent] =
    useState<RegistrationTrackingRow | null>(null);

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

  const queryEnabled =
    appliedFilters.academicTermId.length > 0 &&
    appliedFilters.semesterId.length > 0;

  const trackingFilters: RegistrationTrackingFilters = {
    academicTermId: appliedFilters.academicTermId,
    semesterId: appliedFilters.semesterId,
    ...(isAppliedFirstYearUG && appliedFilters.cycle
      ? { cycle: appliedFilters.cycle as "PHYSICS" | "CHEMISTRY" }
      : {}),
    ...(!isAppliedFirstYearUG && appliedFilters.departmentId
      ? { departmentId: appliedFilters.departmentId }
      : {}),
    ...(appliedFilters.statusFilter && appliedFilters.statusFilter !== "ALL"
      ? {
          statusFilter: appliedFilters.statusFilter as "REGISTERED" | "PENDING",
        }
      : {}),
  };

  const { data: students = [], isLoading } = useRegistrationTracking(
    trackingFilters,
    queryEnabled
  );

  const registeredCount = students.filter((s) => s.isRegistered).length;
  const pendingCount = students.filter((s) => !s.isRegistered).length;

  const [activeTab, setActiveTab] = useState<"regular" | "supplementary">(
    "regular"
  );

  const supplementaryEnabled = appliedFilters.academicTermId.length > 0;
  const {
    data: supplementaryRegistrations = [],
    isLoading: isLoadingSupplementary,
  } = useSupplementaryRegistrations(
    supplementaryEnabled ? appliedFilters.academicTermId : undefined
  );

  const filterFields = useMemo<FilterFieldConfig<TrackingFilterState>[]>(() => {
    const primaryFields: FilterFieldConfig<TrackingFilterState>[] = [
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
      return [
        ...primaryFields,
        {
          key: "statusFilter" as const,
          label: "Status",
          type: "select" as const,
          allOptionLabel: "All statuses",
          options: STATUS_OPTIONS.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })),
        },
      ];
    }

    const scopeField: FilterFieldConfig<TrackingFilterState> = isFirstYearUG
      ? {
          key: "cycle",
          label: "Cycle (Optional)",
          type: "select",
          allOptionLabel: "All cycles",
          options: CYCLE_OPTIONS.map((cycle) => ({
            label: cycle,
            value: cycle,
          })),
        }
      : {
          key: "departmentId",
          label: "Department (Optional)",
          type: "select",
          allOptionLabel: "All departments",
          options: departments.map((department) => ({
            label: department.name,
            value: department.id,
          })),
        };

    return [
      ...primaryFields,
      scopeField,
      {
        key: "statusFilter",
        label: "Status",
        type: "select",
        allOptionLabel: "All statuses",
        options: STATUS_OPTIONS.map((opt) => ({
          label: opt.label,
          value: opt.value,
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Registration Tracking
        </h3>
        <p className="text-muted-foreground text-sm">
          Monitor student registration status across academic terms and
          semesters.
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
          className="md:grid-cols-2 xl:grid-cols-4"
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <FilterActions onApply={applyFilters} onReset={resetFilters} />
        </div>
      </FilterPanel>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "regular" | "supplementary")}
      >
        <TabsList>
          <TabsTrigger value="regular">Regular Registrations</TabsTrigger>
          <TabsTrigger value="supplementary">
            Supplementary Registrations
          </TabsTrigger>
        </TabsList>
        <TabsContent value="regular" className="space-y-4 pt-4">
          {!queryEnabled ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              Select Academic Term and Semester, then apply filters to view
              registration status.
            </div>
          ) : isLoading ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              Loading registration tracking data...
            </div>
          ) : students.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              No students found for the selected filters.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Total: <strong>{students.length}</strong>
                </span>
                <Badge variant="default" className="bg-green-600">
                  Registered: {registeredCount}
                </Badge>
                <Badge variant="secondary" className="bg-yellow-500 text-black">
                  Pending: {pendingCount}
                </Badge>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>USN</TableHead>
                      <TableHead>Student Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Courses</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.studentId}>
                        <TableCell className="font-medium">
                          {student.studentName}
                        </TableCell>
                        <TableCell>{student.usn}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {student.studentEmail}
                        </TableCell>
                        <TableCell>
                          {student.isRegistered ? (
                            <Badge variant="default" className="bg-green-600">
                              Registered
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-yellow-500 text-black"
                            >
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.isRegistered
                            ? `${student.registeredCourseCount} courses`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {student.isRegistered && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedStudent(student)}
                            >
                              View Courses
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="supplementary" className="space-y-4 pt-4">
          {!supplementaryEnabled ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              Select an Academic Term and apply filters to view supplementary
              registrations.
            </div>
          ) : isLoadingSupplementary ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              Loading supplementary registrations...
            </div>
          ) : supplementaryRegistrations.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              No supplementary registrations for this term.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>USN</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Registered At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplementaryRegistrations.map((registration) => (
                    <TableRow key={registration.id}>
                      <TableCell className="font-medium">
                        {registration.usn}
                      </TableCell>
                      <TableCell>{registration.studentName}</TableCell>
                      <TableCell>
                        {registration.code} — {registration.courseName}
                      </TableCell>
                      <TableCell>{registration.totalCredits}</TableCell>
                      <TableCell>{registration.semesterLabel}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(
                          registration.registrationDate
                        ).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <StudentCoursesSheet
        open={!!selectedStudent}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null);
          }
        }}
        student={selectedStudent}
        semesterId={appliedFilters.semesterId}
        academicTermId={appliedFilters.academicTermId}
      />
    </div>
  );
};
