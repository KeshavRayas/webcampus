"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import axios from "axios";
import React, { useEffect, useMemo } from "react";
import { GenerateSectionsDialog } from "./generate-sections-dialog";
import { SectionCardsView } from "./section-cards-view";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;
type SectionCycle = (typeof BASIC_SCIENCES_CYCLE_OPTIONS)[number];

const isRestrictedFirstYearUgSemester = (semester: {
  semesterNumber: number;
  programType: string;
}) =>
  semester.programType === "UG" &&
  FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber);

export const DepartmentSectionView = () => {
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const [termId, setTermId] = React.useState("");
  const [semesterId, setSemesterId] = React.useState("");
  const [semesterNumber, setSemesterNumber] = React.useState<number | null>(
    null
  );
  const [semesterProgramType, setSemesterProgramType] = React.useState<
    string | null
  >(null);
  const [selectedCycle, setSelectedCycle] = React.useState<SectionCycle>(
    BASIC_SCIENCES_CYCLE_OPTIONS[0]
  );

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

  const { data: terms } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [] as AcademicTermResponseType[];
    },
  });

  const isBasicSciences = deptInfo?.type === "BASIC_SCIENCES";
  const termOptions = Array.isArray(terms) ? terms : [];
  const selectedTerm = termOptions.find((term) => term.id === termId);
  const nestedSemesters = selectedTerm?.Semester ?? [];
  const academicYear = selectedTerm?.year ?? "";

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
    (semester) => semester.id === semesterId
  );
  const isRestrictedForNonBasic =
    !isBasicSciences &&
    !!selectedSemesterFromAll &&
    isRestrictedFirstYearUgSemester(selectedSemesterFromAll);

  useEffect(() => {
    if (isBasicSciences) {
      return;
    }

    setSelectedCycle(BASIC_SCIENCES_CYCLE_OPTIONS[0]);
  }, [isBasicSciences]);

  useEffect(() => {
    if (termId || termOptions.length === 0) {
      return;
    }

    const currentTerm =
      termOptions.find((term) => term.isCurrent) ?? termOptions[0];
    if (currentTerm) {
      setTermId(currentTerm.id);
    }
  }, [termId, termOptions]);

  useEffect(() => {
    if (!semesterId) {
      setSemesterNumber(null);
      setSemesterProgramType(null);
      return;
    }

    const sem = semesterOptions.find((semester) => semester.id === semesterId);
    if (!sem) {
      setSemesterId("");
      setSemesterNumber(null);
      setSemesterProgramType(null);
      return;
    }

    setSemesterNumber(sem.semesterNumber);
    setSemesterProgramType(sem.programType);
  }, [semesterId, semesterOptions]);

  useEffect(() => {
    if (!termId || semesterId) {
      return;
    }

    if (semesterOptions.length > 0) {
      setSemesterId(semesterOptions[0]!.id);
    }
  }, [semesterId, semesterOptions, termId]);

  const hasSelectedTermAndSem = Boolean(termId && semesterId);
  const isUgFirstYearReadOnly =
    deptInfo?.type !== "BASIC_SCIENCES" &&
    semesterProgramType === "UG" &&
    (semesterNumber === 1 || semesterNumber === 2);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Academic Term</Label>
          <Select
            value={termId}
            onValueChange={(value) => {
              setTermId(value);
              setSemesterId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select term..." />
            </SelectTrigger>
            <SelectContent>
              {termOptions.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.type.charAt(0).toUpperCase() + term.type.slice(1)}{" "}
                  {term.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Semester</Label>
          <Select
            value={semesterId}
            onValueChange={setSemesterId}
            disabled={!termId || semesterOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select semester..." />
            </SelectTrigger>
            <SelectContent>
              {semesterOptions.length > 0 ? (
                semesterOptions.map((semester) => (
                  <SelectItem key={semester.id} value={semester.id}>
                    {semester.programType} - Semester {semester.semesterNumber}
                  </SelectItem>
                ))
              ) : (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">
                  No semesters available for this term
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {isBasicSciences ? (
          <div className="space-y-1.5">
            <Label>Cycle</Label>
            <Select
              value={selectedCycle}
              onValueChange={(value) => setSelectedCycle(value as SectionCycle)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cycle..." />
              </SelectTrigger>
              <SelectContent>
                {BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => (
                  <SelectItem key={cycle} value={cycle}>
                    {cycle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

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
                termId={termId}
                semesterId={semesterId}
                semesterNumber={semesterNumber ?? 0}
                cycle={selectedCycle}
              />
            ) : null}
          </div>

          {/* Section cards with student details */}
          <SectionCardsView
            semesterId={semesterId}
            academicYear={academicYear}
            isUgFirstYearReadOnly={isUgFirstYearReadOnly}
            isBasicSciences={isBasicSciences}
            selectedCycle={selectedCycle}
          />
        </>
      )}
    </div>
  );
};
