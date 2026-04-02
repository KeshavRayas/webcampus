"use client";

import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo } from "react";
import { GenerateSectionsDialog } from "./generate-sections-dialog";
import { SectionCardsView } from "./section-cards-view";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;
type SectionCycle = (typeof BASIC_SCIENCES_CYCLE_OPTIONS)[number];

type SectionFilters = {
  termId: string;
  semesterId: string;
  cycle: string;
};

const EMPTY_FILTERS: SectionFilters = {
  termId: "",
  semesterId: "",
  cycle: "",
};

const isRestrictedFirstYearUgSemester = (semester: {
  semesterNumber: number;
  programType: string;
}) =>
  semester.programType === "UG" &&
  FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber);

export const DepartmentSectionView = () => {
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [draftFilters, setDraftFilters] = React.useState<SectionFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = React.useState<SectionFilters>(
    () => getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

  const [semesterNumber, setSemesterNumber] = React.useState<number | null>(
    null
  );
  const [semesterProgramType, setSemesterProgramType] = React.useState<
    string | null
  >(null);

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{ type: string; name: string; id: string }>
      >(`${NEXT_PUBLIC_API_BASE_URL}/department/section/department-info`, {
        withCredentials: true,
      });
      if (res.data.status === "success") return res.data.data;
      return { type: "DEGREE_GRANTING", name: "", id: "" };
    },
    enabled: !!session?.user?.id,
  });

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const isBasicSciences = deptInfo?.type === "BASIC_SCIENCES";
  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.termId
  );
  const nestedSemesters = selectedDraftTerm?.Semester ?? [];

  // Sync filters when data changes (auto-clear if value no longer exists)
  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
  });

  const selectedAppliedTerm = terms.find(
    (term) => term.id === appliedFilters.termId
  );
  const academicYear = selectedAppliedTerm?.year ?? "";

  const semesterOptions = useMemo(() => {
    if (isBasicSciences) {
      return nestedSemesters.filter(
        (semester) =>
          semester.programType === "UG" &&
          FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber)
      );
    }

    return nestedSemesters.filter(
      (semester) => !isRestrictedFirstYearUgSemester(semester)
    );
  }, [isBasicSciences, nestedSemesters]);

  const selectedSemesterFromAll = nestedSemesters.find(
    (semester) => semester.id === appliedFilters.semesterId
  );
  const isRestrictedForNonBasic =
    !isBasicSciences &&
    !!selectedSemesterFromAll &&
    isRestrictedFirstYearUgSemester(selectedSemesterFromAll);

  useEffect(() => {
    if (isBasicSciences && !draftFilters.cycle) {
      setDraftFilters((current) => ({
        ...current,
        cycle: BASIC_SCIENCES_CYCLE_OPTIONS[0],
      }));
      return;
    }

    if (!isBasicSciences && draftFilters.cycle) {
      setDraftFilters((current) => ({
        ...current,
        cycle: "",
      }));
    }
  }, [draftFilters.cycle, isBasicSciences]);

  useEffect(() => {
    if (draftFilters.termId || terms.length === 0) {
      return;
    }

    const currentTerm = terms.find((term) => term.isCurrent) ?? terms[0];
    if (currentTerm) {
      setDraftFilters((current) => ({
        ...current,
        termId: currentTerm.id,
      }));
    }
  }, [draftFilters.termId, terms]);

  useEffect(() => {
    if (!appliedFilters.semesterId) {
      setSemesterNumber(null);
      setSemesterProgramType(null);
      return;
    }

    const sem = (selectedAppliedTerm?.Semester || []).find(
      (semester) => semester.id === appliedFilters.semesterId
    );
    if (!sem) {
      setSemesterNumber(null);
      setSemesterProgramType(null);
      return;
    }

    setSemesterNumber(sem.semesterNumber);
    setSemesterProgramType(sem.programType);
  }, [appliedFilters.semesterId, selectedAppliedTerm]);

  useEffect(() => {
    if (!draftFilters.termId || draftFilters.semesterId) {
      return;
    }

    if (semesterOptions.length > 0) {
      setDraftFilters((current) => ({
        ...current,
        semesterId: semesterOptions[0]!.id,
      }));
    }
  }, [draftFilters.semesterId, draftFilters.termId, semesterOptions]);

  useEffect(() => {
    if (appliedFilters.termId && appliedFilters.semesterId) {
      return;
    }

    if (!draftFilters.termId || !draftFilters.semesterId) {
      return;
    }

    setAppliedFilters({
      ...draftFilters,
      cycle: isBasicSciences
        ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
        : "",
    });
  }, [
    appliedFilters.semesterId,
    appliedFilters.termId,
    draftFilters,
    isBasicSciences,
  ]);

  const updateDraftFilter = (key: keyof SectionFilters, value: string) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      cycle: isBasicSciences
        ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
        : "",
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

  const sectionFilterFields: FilterFieldConfig<SectionFilters>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      allOptionLabel: "All terms",
      placeholder: "Select term...",
      options: terms.map((term) => ({
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)} ${term.year}`,
        value: term.id,
      })),
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      allOptionLabel: "All semesters",
      placeholder: draftFilters.termId
        ? "Select semester..."
        : "Select term first",
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
    ...(isBasicSciences
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            allOptionLabel: "All cycles",
            placeholder: "Select cycle...",
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
          } as FilterFieldConfig<SectionFilters>,
        ]
      : []),
  ];

  const hasSelectedTermAndSem = Boolean(
    appliedFilters.termId && appliedFilters.semesterId
  );
  const isUgFirstYearReadOnly =
    deptInfo?.type !== "BASIC_SCIENCES" &&
    semesterProgramType === "UG" &&
    (semesterNumber === 1 || semesterNumber === 2);

  const appliedCycle =
    isBasicSciences && appliedFilters.cycle
      ? (appliedFilters.cycle as SectionCycle)
      : BASIC_SCIENCES_CYCLE_OPTIONS[0];

  return (
    <div className="flex flex-col gap-6">
      <FilterPanel>
        <FilterBuilder
          fields={sectionFilterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            if (key === "termId") {
              setDraftFilters((current) => ({
                ...current,
                termId: value,
                semesterId: "",
              }));
              return;
            }

            updateDraftFilter(key, value);
          }}
          allValue={DEFAULT_FILTER_ALL_VALUE}
          className="md:grid-cols-2 xl:grid-cols-3"
        />
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </FilterPanel>

      {isRestrictedForNonBasic ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>403 Unauthorized:</strong> First-year sections are managed by
          the Basic Sciences department.
        </div>
      ) : (
        <>
          {/* Header with Generate action */}
          <div className="flex items-center justify-end gap-2">
            {hasSelectedTermAndSem && !isUgFirstYearReadOnly ? (
              <GenerateSectionsDialog
                termId={appliedFilters.termId}
                semesterId={appliedFilters.semesterId}
                semesterNumber={semesterNumber ?? 0}
                cycle={appliedCycle}
              />
            ) : null}
          </div>

          {/* Section cards with student details */}
          <SectionCardsView
            semesterId={appliedFilters.semesterId}
            academicYear={academicYear}
            isUgFirstYearReadOnly={isUgFirstYearReadOnly}
            isBasicSciences={isBasicSciences}
            selectedCycle={appliedCycle}
          />
        </>
      )}
    </div>
  );
};
