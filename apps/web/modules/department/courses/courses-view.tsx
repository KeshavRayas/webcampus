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
import React, { useState } from "react";
import { SemesterCourseBlock } from "./semester-course-block";

export const CoursesView: React.FC = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();
  const departmentName = session?.user?.name;

  // Cascading state
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

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
  const nestedSemesters = selectedTerm?.Semester || [];
  const selectedSemester = nestedSemesters.find(
    (s) => s.id === selectedSemesterId
  );

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
            disabled={!selectedTermId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select semester..." />
            </SelectTrigger>
            <SelectContent>
              {nestedSemesters.map((semester) => (
                <SelectItem key={semester.id} value={semester.id}>
                  {semester.programType} - Semester {semester.semesterNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              courses={courses || []}
            />
          )}
        </div>
      )}
    </div>
  );
};
