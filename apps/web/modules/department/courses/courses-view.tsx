"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
import { CourseResponseDTO } from "@webcampus/schemas/department";
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { SemesterCourseBlock } from "./semester-course-block";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;
type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

export const CoursesView: React.FC = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentName = session?.user?.name;

  // Fetch department type for conditional rendering
  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<{ type: string; name: string }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/department-info`,
        {
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return { type: "DEGREE_GRANTING", name: "" };
    },
    enabled: !!session?.user?.id,
  });

  const departmentType = deptInfo?.type ?? "DEGREE_GRANTING";
  const isBasicSciences = departmentType === "BASIC_SCIENCES";

  // Cascading state
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<CourseCycle>("PHYSICS");

  useEffect(() => {
    if (isBasicSciences && selectedCycle === "NONE") {
      setSelectedCycle(BASIC_SCIENCES_CYCLE_OPTIONS[0]);
      return;
    }

    if (!isBasicSciences && selectedCycle !== "NONE") {
      setSelectedCycle("NONE");
    }
  }, [isBasicSciences, selectedCycle]);

  // Fetch all available academic terms (with nested semesters)
  const { data: terms } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
  });

  const termOptions = Array.isArray(terms) ? terms : [];
  const selectedTerm = termOptions.find((t) => t.id === selectedTermId);
  const allSemestersForTerm = selectedTerm?.Semester ?? [];

  const semesterOptions = useMemo(() => {
    const isFirstYearUgSemester = (semester: {
      programType: string;
      semesterNumber: number;
    }) =>
      semester.programType === "UG" &&
      FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber);

    if (!isBasicSciences) {
      return allSemestersForTerm.filter(
        (semester) => !isFirstYearUgSemester(semester)
      );
    }

    return allSemestersForTerm.filter((semester) =>
      isFirstYearUgSemester(semester)
    );
  }, [allSemestersForTerm, isBasicSciences]);

  const selectedSemester = semesterOptions.find(
    (s) => s.id === selectedSemesterId
  );

  useEffect(() => {
    if (!selectedSemesterId) {
      return;
    }

    const isSelectedSemesterAllowed = semesterOptions.some(
      (semester) => semester.id === selectedSemesterId
    );

    if (!isSelectedSemesterAllowed) {
      setSelectedSemesterId("");
    }
  }, [selectedSemesterId, semesterOptions]);

  useEffect(() => {
    if (selectedTermId || termOptions.length === 0) {
      return;
    }

    const currentTerm =
      termOptions.find((term) => term.isCurrent) ?? termOptions[0];
    if (currentTerm) {
      setSelectedTermId(currentTerm.id);
    }
  }, [selectedTermId, termOptions]);

  useEffect(() => {
    if (!selectedTermId) {
      return;
    }

    if (selectedSemesterId) {
      return;
    }

    const requestedSemesterParam =
      searchParams.get("semesterId") ?? searchParams.get("semester");

    if (requestedSemesterParam) {
      const isRequestedSemesterAllowed = semesterOptions.some(
        (semester) => semester.id === requestedSemesterParam
      );

      if (isRequestedSemesterAllowed) {
        setSelectedSemesterId(requestedSemesterParam);
      } else {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("semesterId");
        nextParams.delete("semester");
        const nextUrl = nextParams.toString()
          ? `${pathname}?${nextParams.toString()}`
          : pathname;
        router.replace(nextUrl, { scroll: false });
      }
      return;
    }

    if (semesterOptions.length > 0) {
      setSelectedSemesterId(semesterOptions[0]!.id);
    }
  }, [
    pathname,
    router,
    searchParams,
    selectedSemesterId,
    selectedTermId,
    semesterOptions,
  ]);

  // Fetch courses ONLY for the selected semester instance
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses", departmentName, selectedSemesterId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CourseResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/branch`,
        {
          params: { name: departmentName, semesterId: selectedSemesterId },
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
    enabled: !!departmentName && !!selectedSemesterId,
  });

  const filteredCourses = useMemo(() => {
    const courseList = courses ?? [];
    return courseList.filter(
      (course) => (course.cycle ?? "NONE") === selectedCycle
    );
  }, [courses, selectedCycle]);

  return (
    <div className="space-y-8">
      {/* Cascading Semester Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-60 space-y-2">
          <Label>Academic Term</Label>
          <Select
            value={selectedTermId}
            onValueChange={(value) => {
              setSelectedTermId(value);
              setSelectedSemesterId(""); // Reset child
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

        <div className="w-60 space-y-2">
          <Label>Semester</Label>
          <Select
            value={selectedSemesterId}
            onValueChange={setSelectedSemesterId}
            disabled={!selectedTermId || semesterOptions.length === 0}
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
          <div className="w-60 space-y-2">
            <Label>Cycle</Label>
            <Select
              value={selectedCycle}
              onValueChange={(value) => setSelectedCycle(value as CourseCycle)}
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

      {/* Render the semester blocks if an instance is selected */}
      {selectedSemester && (
        <div className="space-y-6">
          {coursesLoading ? (
            <div>Loading courses...</div>
          ) : (
            <SemesterCourseBlock
              key={selectedSemester.id}
              semesterId={selectedSemester.id}
              semesterNumber={selectedSemester.semesterNumber}
              courses={filteredCourses}
              departmentType={departmentType}
              programType={selectedSemester.programType}
              selectedCycle={selectedCycle}
              isBasicSciences={isBasicSciences}
            />
          )}
        </div>
      )}
    </div>
  );
};
