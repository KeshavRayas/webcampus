"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { SemesterResponseType } from "@webcampus/schemas/admin";
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

const ODD_SEMESTERS = [1, 3, 5, 7];
const EVEN_SEMESTERS = [2, 4, 6, 8];

export const CoursesView: React.FC = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();
  const departmentName = session?.user?.name;

  // Track the globally selected semester instance
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  // Fetch all available semester instances for the dropdown
  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SemesterResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
  });

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
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
    enabled: !!departmentName && !!selectedSemesterId,
  });

  const selectedSemester = semesters?.find((s) => s.id === selectedSemesterId);
  const semesterNumbers =
    selectedSemester?.type === "odd" ? ODD_SEMESTERS : EVEN_SEMESTERS;

  return (
    <div className="space-y-8">
      {/* Global Semester Selector */}
      <div className="w-full max-w-sm space-y-2">
        <Label>Select Academic Semester Instance</Label>
        <Select
          value={selectedSemesterId}
          onValueChange={setSelectedSemesterId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a semester..." />
          </SelectTrigger>
          <SelectContent>
            {semesters?.map((sem) => (
              <SelectItem key={sem.id} value={sem.id}>
                {sem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Render the 4 blocks if an instance is selected */}
      {selectedSemester && (
        <div className="space-y-6">
          {coursesLoading ? (
            <div>Loading courses...</div>
          ) : (
            semesterNumbers.map((num) => {
              // Pre-filter courses for this specific numerical block
              const blockCourses =
                courses?.filter((c) => c.semesterNumber === num) || [];

              return (
                <SemesterCourseBlock
                  key={num}
                  semesterId={selectedSemester.id}
                  semesterNumber={num}
                  courses={blockCourses}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
