"use client";

import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  FacultyHandlingAssignmentDTO,
  FacultyHandlingStudentDTO,
} from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  FacultyHandlingFilters,
  FacultyHandlingKind,
} from "./faculty-handling-types";
import {
  useFacultyHandlingAssignments,
  useFacultyHandlingFilterOptions,
  useFacultyHandlingStudents,
} from "./use-faculty-handling";

const EMPTY_FILTERS: FacultyHandlingFilters = {
  search: "",
  academicTerm: "",
  programType: "",
  semester: "",
  section: "",
  page: "",
};

type FacultyHandlingViewProps = {
  kind: FacultyHandlingKind;
  title: string;
  description: string;
};

const getAssignmentId = (row: FacultyHandlingAssignmentDTO): string | null => {
  return row.assignmentId;
};

const getAssignmentLabel = (
  row: FacultyHandlingAssignmentDTO,
  kind: FacultyHandlingKind
): string => {
  const courseName = row.courseName || "Untitled course";
  const courseCode = row.courseCode ? ` (${row.courseCode})` : "";
  const batchName = row.batchName ? ` - Batch ${row.batchName}` : "";
  const section = row.section ? ` - Section ${row.section}` : "";
  const semester =
    row.semesterNumber != null && row.semesterNumber !== undefined
      ? ` - Sem ${row.semesterNumber}`
      : "";

  if (kind == "courses")
    return `${courseName}${courseCode}${section}${semester}`;
  return `${courseName}${courseCode}${section}${batchName}`;
};

const studentColumns: ColumnDef<FacultyHandlingStudentDTO>[] = [
  {
    header: "USN",
    accessorFn: (row) => row.usn || "-",
  },
  {
    header: "Name",
    accessorFn: (row) => row.name || "-",
  },
  {
    header: "Email",
    accessorFn: (row) => row.email || "-",
  },
  // {
  //   header: "Section",
  //   accessorFn: (row) => row.section || "-",
  // },
  // {
  //   header: "Batch",
  //   accessorFn: (row) => row.batchName || "-",
  // },
  // {
  //   header: "Semester",
  //   accessorFn: (row) =>
  //     row.semesterNumber !== null && row.semesterNumber !== undefined
  //       ? String(row.semesterNumber)
  //       : "-",
  // },

  // Section, Batch and Semester removed for Mobile optimissation
];

export const FacultyHandlingView = ({
  kind,
  title,
  description,
}: FacultyHandlingViewProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [draftFilters, setDraftFilters] = useState<FacultyHandlingFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<FacultyHandlingFilters>(
    () => getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [selectedAssignment, setSelectedAssignment] =
    useState<FacultyHandlingAssignmentDTO | null>(null);

  const filterOptionsQuery = useFacultyHandlingFilterOptions(kind);
  const filterOptions = filterOptionsQuery.data ?? {
    academicTerms: [],
    semesters: [],
    sections: [],
  };

  const selectedTerm = useMemo(
    () =>
      filterOptions.academicTerms.find(
        (term) => term.id === draftFilters.academicTerm
      ),
    [filterOptions.academicTerms, draftFilters.academicTerm]
  );

  const selectedTermSemesters = useMemo(
    () =>
      filterOptions.semesters.filter(
        (semester) => semester.academicTermId === selectedTerm?.id
      ),
    [filterOptions.semesters, selectedTerm?.id]
  );

  const filteredTermSemesters =
    draftFilters.programType.length > 0
      ? selectedTermSemesters.filter(
          (semester) => semester.programType === draftFilters.programType
        )
      : selectedTermSemesters;

  const sectionsBySemester = useMemo(() => {
    return new Map(
      filterOptions.semesters.map((semester) => [semester.id, semester])
    );
  }, [filterOptions.semesters]);

  const filteredSections = useMemo(
    () =>
      filterOptions.sections.filter((section) => {
        if (draftFilters.semester) {
          return section.semesterId === draftFilters.semester;
        }

        const sectionSemester = sectionsBySemester.get(section.semesterId);
        if (!sectionSemester) {
          return false;
        }

        if (
          draftFilters.academicTerm &&
          sectionSemester.academicTermId !== draftFilters.academicTerm
        ) {
          return false;
        }

        if (
          draftFilters.programType &&
          sectionSemester.programType !== draftFilters.programType
        ) {
          return false;
        }

        return true;
      }),
    [
      draftFilters.academicTerm,
      draftFilters.programType,
      draftFilters.semester,
      filterOptions.sections,
      sectionsBySemester,
    ]
  );

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: filterOptions.academicTerms,
    semesters: filteredTermSemesters,
  });

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const assignmentsQuery = useFacultyHandlingAssignments(kind, appliedFilters);

  useEffect(() => {
    if (!assignmentsQuery.isError) {
      return;
    }

    const message =
      assignmentsQuery.error instanceof Error
        ? assignmentsQuery.error.message
        : "Failed to load handling data";

    toast.error(message);
  }, [assignmentsQuery.error, assignmentsQuery.isError]);

  const selectedAssignmentId = selectedAssignment?.assignmentId ?? null;
  const studentFilters = useMemo(
    () => ({
      ...appliedFilters,
      page: "1",
      limit: "100",
    }),
    [appliedFilters]
  );

  const studentsQuery = useFacultyHandlingStudents(
    kind,
    selectedAssignmentId,
    studentFilters
  );

  useEffect(() => {
    if (!filterOptionsQuery.isError) {
      return;
    }

    const message =
      filterOptionsQuery.error instanceof Error
        ? filterOptionsQuery.error.message
        : "Failed to load handling filters";

    toast.error(message);
  }, [filterOptionsQuery.error, filterOptionsQuery.isError]);

  useEffect(() => {
    if (!studentsQuery.isError) {
      return;
    }

    const message =
      studentsQuery.error instanceof Error
        ? studentsQuery.error.message
        : "Failed to load assigned students";

    toast.error(message);
  }, [studentsQuery.error, studentsQuery.isError]);

  const updateDraftFilter = (
    key: keyof FacultyHandlingFilters,
    value: string
  ) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      page: "1",
    };

    setAppliedFilters(nextFilters);
    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  const page = Number.parseInt(appliedFilters.page || "1", 10) || 1;
  const pagination = assignmentsQuery.data?.pagination ?? {
    page,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const rows = assignmentsQuery.data?.items ?? [];
  const totalPages = pagination.totalPages;

  const goToPage = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
    const nextFilters = {
      ...appliedFilters,
      page: String(boundedPage),
    };

    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);

    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });

    queryClient.invalidateQueries({
      queryKey: ["faculty-handling", kind],
    });
  };

  const termOptions = useMemo(
    () =>
      filterOptions.academicTerms.map((term) => ({
        label: `${term.type.toUpperCase()} ${term.year}`,
        value: term.id,
      })),
    [filterOptions.academicTerms]
  );

  const semesterOptions = useMemo(
    () =>
      filteredTermSemesters.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    [filteredTermSemesters]
  );

  const sectionOptions = useMemo(
    () =>
      filteredSections.map((section) => ({
        label: section.name,
        value: section.id,
      })),
    [filteredSections]
  );

  const handlingFilterFields: FilterFieldConfig<FacultyHandlingFilters>[] = [
    {
      key: "search",
      label: "Search",
      type: "text",
      inputId: `${kind}-handling-search`,
      placeholder: "Search by course code or name",
    },
    {
      key: "academicTerm",
      label: "Academic Term",
      type: "select",
      allOptionLabel: "All terms",
      placeholder: "All terms",
      options: termOptions,
    },
    {
      key: "programType",
      label: "Program Type",
      type: "select",
      allOptionLabel: "All programs",
      placeholder: draftFilters.academicTerm
        ? "All programs"
        : "Select term first",
      options: [
        { label: "UG", value: "UG" },
        { label: "PG", value: "PG" },
      ],
    },
    {
      key: "semester",
      label: "Semester",
      type: "select",
      allOptionLabel: "All semesters",
      placeholder: draftFilters.academicTerm
        ? draftFilters.programType
          ? "All semesters"
          : "Select program type"
        : "Select term first",
      options: semesterOptions,
    },
    {
      key: "section",
      label: "Section",
      type: "select",
      allOptionLabel: "All sections",
      placeholder: draftFilters.academicTerm
        ? "All sections"
        : "Select term first",
      options: sectionOptions,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={handlingFilterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            if (key === "academicTerm") {
              setDraftFilters((current) => ({
                ...current,
                academicTerm: value,
                programType: "",
                semester: "",
                section: "",
                page: "1",
              }));
              return;
            }

            if (key === "programType") {
              setDraftFilters((current) => ({
                ...current,
                programType: value,
                semester: "",
                section: "",
                page: "1",
              }));
              return;
            }

            if (key === "semester") {
              setDraftFilters((current) => ({
                ...current,
                semester: value,
                section: "",
                page: "1",
              }));
              return;
            }

            updateDraftFilter(key, value);
          }}
          allValue={DEFAULT_FILTER_ALL_VALUE}
          className="md:grid-cols-2 xl:grid-cols-5"
        />
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </FilterPanel>

      {assignmentsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : assignmentsQuery.isError ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Unable to load handling data right now.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No assignments found for the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-muted-foreground text-sm">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} assignments
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="h-10 px-4 text-left align-middle text-sm font-medium">
                  Course Code
                </th>
                <th className="h-10 px-4 text-left align-middle text-sm font-medium">
                  Course
                </th>
                <th className="h-10 px-4 text-left align-middle text-sm font-medium">
                  Semester
                </th>
                <th className="h-10 px-4 text-left align-middle text-sm font-medium">
                  Section
                </th>
                {kind !== "courses" && (
                  <th className="h-10 px-4 text-left align-middle text-sm font-medium">
                    Batch
                  </th>
                )}
                <th className="h-10 px-4 text-left align-middle text-sm font-medium">
                  Students
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowId = getAssignmentId(row) || `row-${index}`;

                return (
                  <tr
                    key={rowId}
                    className="hover:bg-muted/50 cursor-pointer border-b"
                    onClick={() => setSelectedAssignment(row)}
                  >
                    <td className="p-4 text-sm">{row.courseCode || "-"}</td>
                    <td className="p-4 text-sm">{row.courseName || "-"}</td>
                    <td className="p-4 text-sm">
                      {row.semesterNumber !== null &&
                      row.semesterNumber !== undefined
                        ? row.semesterNumber
                        : "-"}
                    </td>
                    <td className="p-4 text-sm">{row.section || "-"}</td>
                    {/* hidden batch cell for courses */}
                    {kind !== "courses" && (
                      <td className="p-4 text-sm">{row.batchName || "-"}</td>
                    )}
                    <td className="p-4 text-sm">
                      {row.studentCount !== null &&
                      row.studentCount !== undefined
                        ? row.studentCount
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="border-input bg-background hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="border-input bg-background hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(selectedAssignment)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAssignment(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assigned Students</DialogTitle>
            <DialogDescription>
              {selectedAssignment
                ? getAssignmentLabel(selectedAssignment, kind)
                : "Selected assignment"}
              {/* passed "kind" parameter to getAssignmentLabel */}
            </DialogDescription>
          </DialogHeader>

          {studentsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : studentsQuery.isError ? (
            <div className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
              Unable to load students for this assignment.
            </div>
          ) : (studentsQuery.data?.items || []).length === 0 ? (
            <div className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
              No students are currently assigned.
            </div>
          ) : (
            <DataTable
              columns={studentColumns}
              data={studentsQuery.data?.items || []}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
