"use client";

import { ReasonDialog } from "@/components/admin/reason-dialog";
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
}

export const ManageCoordinatorsCard = ({
  course,
}: ManageCoordinatorsCardProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);
  const [showReasonDialog, setShowReasonDialog] = useState(false);

  const isLocked =
    course.approvalStatus === "PENDING" || course.approvalStatus === "APPROVED";

  const { data: rawFaculty, isLoading: loadingFaculty } = useQuery({
    queryKey: ["admin-mapped-faculty", course.id],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultyData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/${course.id}/mapped-faculty`,
        { withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!course.id,
  });

  const faculty = rawFaculty ?? [];

  const { data: rawCoordinators, isLoading: loadingCoordinators } = useQuery({
    queryKey: ["admin-course-coordinators", course.id],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CoordinatorEntry[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/${course.id}/coordinators`,
        { withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!course.id,
  });

  const existingCoordinators = rawCoordinators ?? [];

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

  const doSave = (reason?: string) => {
    const payload: Record<string, unknown> = {
      facultyIds: selectedFacultyIds,
    };

    if (reason) {
      payload.reason = reason;
    }

    return axios.put(
      `${NEXT_PUBLIC_API_BASE_URL}/admin/course/${course.id}/coordinators`,
      payload,
      { withCredentials: true }
    );
  };

  const saveMutation = useMutation({
    mutationFn: async (reason?: string) => doSave(reason),
    onSuccess: (res) => {
      toast.success(res.data.message || "Coordinators saved successfully");
      queryClient.invalidateQueries({
        queryKey: ["admin-course-coordinators", course.id],
      });
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        if (err.response?.status === 409) {
          toast.error(
            err.response?.data?.message ||
              "This course has been modified by another administrator. Please refresh."
          );
          return;
        }
        toast.error(
          err.response?.data?.message || "Failed to save coordinators"
        );
        return;
      }
      toast.error("Failed to save coordinators");
    },
  });

  const handleSaveClick = () => {
    if (isLocked) {
      setShowReasonDialog(true);
    } else {
      saveMutation.mutate(undefined);
    }
  };

  const handleReasonConfirm = (reason: string) => {
    setShowReasonDialog(false);
    saveMutation.mutate(reason);
  };

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
    <>
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
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveClick}
              disabled={saveMutation.isPending}
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

      <ReasonDialog
        open={showReasonDialog}
        onOpenChange={setShowReasonDialog}
        onConfirm={handleReasonConfirm}
        isRequired={true}
      />
    </>
  );
};
