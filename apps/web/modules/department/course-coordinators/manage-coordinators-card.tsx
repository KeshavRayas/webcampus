"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { MultiCombobox } from "@webcampus/ui/molecules/multi-combobox";
import axios, { AxiosError } from "axios";
import { Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

interface FacultyData {
  id: string;
  name: string;
  departmentAbbreviation: string;
}

interface CoordinatorEntry {
  id: string;
  courseId: string;
  facultyId: string;
  faculty: {
    id: string;
    shortName: string;
    departmentId: string;
    user: { name: string };
  };
}

interface ManageCoordinatorsCardProps {
  course: CourseResponseDTO;
  isLocked?: boolean;
}

export const ManageCoordinatorsCard = ({
  course,
  isLocked = false,
}: ManageCoordinatorsCardProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);

  // Fetch faculty mapped to this course (from CourseAssignment)
  const { data: rawFaculty, isLoading: loadingFaculty } = useQuery({
    queryKey: ["mapped-faculty", course.id],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultyData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/${course.id}/mapped-faculty`,
        { withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!course.id,
  });

  const faculty = rawFaculty ?? [];

  // Fetch existing coordinators
  const { data: rawCoordinators, isLoading: loadingCoordinators } = useQuery({
    queryKey: ["course-coordinators", course.id],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CoordinatorEntry[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/${course.id}/coordinators`,
        { withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!course.id,
  });

  const existingCoordinators = rawCoordinators ?? [];

  // Sync selected state when existing coordinators load
  useEffect(() => {
    if (!loadingCoordinators && existingCoordinators.length >= 0) {
      setSelectedFacultyIds(existingCoordinators.map((c) => c.facultyId));
    }
  }, [existingCoordinators, loadingCoordinators]);

  const facultyOptions = useMemo(
    () =>
      faculty.map((f) => ({
        value: f.id,
        label: f.name,
        sublabel: f.departmentAbbreviation,
      })),
    [faculty]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      return axios.put(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/${course.id}/coordinators`,
        { facultyIds: selectedFacultyIds },
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message || "Coordinators saved successfully");
      queryClient.invalidateQueries({
        queryKey: ["course-coordinators", course.id],
      });
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message
          : "Failed to save coordinators";
      toast.error(message || "Failed to save coordinators");
    },
  });

  const isLoading = loadingFaculty || loadingCoordinators;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="size-5" />
          Manage Coordinators
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Assign Faculty as Coordinators
          </label>
          <p className="text-muted-foreground text-xs">
            Select one or more faculty members to coordinate this course.
            Coordinators can set up question papers and assessment templates.
          </p>
          <MultiCombobox
            options={facultyOptions}
            value={selectedFacultyIds}
            onValueChange={setSelectedFacultyIds}
            placeholder="Search and select faculty..."
            searchPlaceholder="Search faculty by name..."
            emptyMessage="No faculty found."
            disabled={isLocked}
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLocked}
            size="lg"
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save Coordinators
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
