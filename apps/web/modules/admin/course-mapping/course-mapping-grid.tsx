"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CourseMappingByCourseItemType,
  CourseResponseDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Combobox } from "@webcampus/ui/molecules/combobox";
import axios, { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

interface SectionData {
  id: string;
  name: string;
  batches: { id: string; name: string }[];
}

interface FacultyData {
  id: string;
  name: string;
  departmentAbbreviation: string;
}

interface AdminCourseMappingGridProps {
  course: CourseResponseDTO;
  departmentName: string;
  semesterId: string;
  academicYear: string;
  cycle: string;
  isBasicSciences: boolean;
  isLocked?: boolean;
}

type SectionMappingState = {
  sectionId: string;
  theoryFacultyId: string | null;
  labFacultyByBatch: { batchName: string; facultyId: string | null }[];
};

const DEFAULT_BATCHES = ["L1", "L2", "L3", "L4"];

export const AdminCourseMappingGrid = ({
  course,
  departmentName,
  semesterId,
  academicYear,
  cycle,
  isBasicSciences,
  isLocked = false,
}: AdminCourseMappingGridProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const hasSectionFaculty =
    (course.lectureCredits ?? 0) > 0 || (course.tutorialCredits ?? 0) > 0;
  const hasLab = (course.practicalCredits ?? 0) > 0;

  const { data: rawSections, isLoading: loadingSections } = useQuery({
    queryKey: ["admin-mapping-sections", departmentName, semesterId, cycle],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SectionData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/sections`,
        {
          params: { semesterId, departmentName, cycle },
          withCredentials: true,
        }
      );

      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!departmentName && !!semesterId,
  });

  const sections = rawSections ?? [];

  const { data: rawFaculty, isLoading: loadingFaculty } = useQuery({
    queryKey: ["admin-mapping-faculty", departmentName],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultyData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/faculty`,
        {
          params: { departmentName },
          withCredentials: true,
        }
      );

      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!departmentName,
  });

  const faculty = rawFaculty ?? [];

  const { data: rawExistingMappings, isLoading: loadingExisting } = useQuery({
    queryKey: ["admin-course-mapping", course.id, semesterId, academicYear],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<CourseMappingByCourseItemType[]>
      >(`${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/by-course`, {
        params: {
          courseId: course.id,
          semesterId,
          academicYear,
          departmentName,
        },
        withCredentials: true,
      });

      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!course.id && !!semesterId && !!academicYear && !!departmentName,
  });

  const existingMappings = rawExistingMappings ?? [];

  const facultyOptions = useMemo(
    () =>
      faculty.map((member) => ({
        value: member.id,
        label: member.name,
        sublabel: isBasicSciences ? member.departmentAbbreviation : undefined,
      })),
    [faculty, isBasicSciences]
  );

  const [mappings, setMappings] = useState<SectionMappingState[]>([]);

  useEffect(() => {
    if (loadingSections || loadingExisting) {
      return;
    }

    const initialState: SectionMappingState[] = sections.map((section) => {
      const existingTheory = existingMappings.find(
        (mapping) =>
          mapping.sectionId === section.id &&
          mapping.assignmentType === "THEORY"
      );

      const labBatches = DEFAULT_BATCHES.map((batchName) => {
        const existingLab = existingMappings.find(
          (mapping) =>
            mapping.sectionId === section.id &&
            mapping.assignmentType === "LAB" &&
            mapping.batchName === batchName
        );

        return {
          batchName,
          facultyId: existingLab ? existingLab.facultyId : null,
        };
      });

      return {
        sectionId: section.id,
        theoryFacultyId: existingTheory ? existingTheory.facultyId : null,
        labFacultyByBatch: labBatches,
      };
    });

    setMappings(initialState);
  }, [existingMappings, loadingExisting, loadingSections, sections]);

  const updateTheory = (sectionId: string, facultyId: string | null) => {
    setMappings((previous) =>
      previous.map((mapping) =>
        mapping.sectionId === sectionId
          ? { ...mapping, theoryFacultyId: facultyId }
          : mapping
      )
    );
  };

  const updateLab = (
    sectionId: string,
    batchName: string,
    facultyId: string | null
  ) => {
    setMappings((previous) =>
      previous.map((mapping) => {
        if (mapping.sectionId !== sectionId) {
          return mapping;
        }

        return {
          ...mapping,
          labFacultyByBatch: mapping.labFacultyByBatch.map((batch) =>
            batch.batchName === batchName ? { ...batch, facultyId } : batch
          ),
        };
      })
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        courseId: course.id,
        departmentName,
        semesterId,
        academicYear,
        studentsPerLabBatch: 15,
        sectionMappings: mappings.map((mapping) => ({
          sectionId: mapping.sectionId,
          theoryFacultyId: hasSectionFaculty ? mapping.theoryFacultyId : null,
          labFacultyByBatch: hasLab
            ? mapping.labFacultyByBatch.filter(
                (batch) => batch.facultyId !== null
              )
            : [],
        })),
      };

      return axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/upsert`,
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-course-mapping"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-course-mapping-status"],
      });
    },
    onError: (error) => {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message
          : "Failed to save mappings";
      toast.error(message || "Failed to save mappings");
    },
  });

  const isLoading = loadingSections || loadingFaculty || loadingExisting;

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        No sections found for this selection.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted border-b font-medium leading-normal">
            <tr>
              <th className="border-border min-w-[100px] border-r px-4 py-3">
                Section
              </th>
              {hasSectionFaculty && (
                <th className="border-border min-w-[200px] border-r px-4 py-3">
                  Section Faculty
                </th>
              )}
              {hasLab &&
                DEFAULT_BATCHES.map((batch) => (
                  <th
                    key={batch}
                    className="border-border min-w-[200px] border-r px-4 py-3 text-center last:border-0"
                  >
                    Lab: {batch}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sections.map((section) => {
              const state = mappings.find(
                (mapping) => mapping.sectionId === section.id
              );
              if (!state) {
                return null;
              }

              return (
                <tr
                  key={section.id}
                  className="hover:bg-muted/50 group transition-colors"
                >
                  <td className="border-border bg-muted/20 group-hover:bg-muted/60 border-r px-4 py-4 font-medium">
                    {section.name}
                  </td>

                  {hasSectionFaculty && (
                    <td className="border-border border-r px-4">
                      <Combobox
                        options={facultyOptions}
                        value={state.theoryFacultyId}
                        onValueChange={(value) =>
                          updateTheory(section.id, value)
                        }
                        placeholder="Select Section Faculty"
                        className="bg-background"
                        disabled={isLocked}
                      />
                    </td>
                  )}

                  {hasLab &&
                    DEFAULT_BATCHES.map((batchName) => {
                      const batchState = state.labFacultyByBatch.find(
                        (batch) => batch.batchName === batchName
                      );

                      return (
                        <td
                          key={batchName}
                          className="border-border border-r px-4 last:border-0"
                        >
                          <Combobox
                            options={facultyOptions}
                            value={batchState?.facultyId ?? null}
                            onValueChange={(value) =>
                              updateLab(section.id, batchName, value)
                            }
                            placeholder={`Select ${batchName} Faculty`}
                            className="bg-background text-xs"
                            disabled={isLocked}
                          />
                        </td>
                      );
                    })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLocked}
          size="lg"
        >
          {saveMutation.isPending && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Mappings
        </Button>
      </div>
    </div>
  );
};
