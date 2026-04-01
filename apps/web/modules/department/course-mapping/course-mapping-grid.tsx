"use client";

import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO, CourseMappingByCourseItemType } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Combobox } from "@webcampus/ui/molecules/combobox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
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

interface CourseMappingGridProps {
  course: CourseResponseDTO;
  semesterId: string;
  academicYear: string;
  cycle: string;
  isBasicSciences: boolean;
}

type SectionMappingState = {
  sectionId: string;
  theoryFacultyId: string | null;
  labFacultyByBatch: { batchName: string; facultyId: string | null }[];
};

const DEFAULT_BATCHES = ["L1", "L2", "L3", "L4"];

export const CourseMappingGrid = ({
  course,
  semesterId,
  academicYear,
  cycle,
  isBasicSciences,
}: CourseMappingGridProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const hasTheory = ["INTEGRATED", "NON_INTEGRATED", "NCMC"].includes(course.courseMode);
  const hasLab = ["INTEGRATED", "FINAL_SUMMARY"].includes(course.courseMode);

  // Fetch sections
  const { data: rawSections, isLoading: loadingSections } = useQuery({
    queryKey: ["sections", semesterId, cycle],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SectionData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/sections`,
        { params: { semesterId, cycle }, withCredentials: true }
      );
      return res.data.status === "success" && res.data.data ? res.data.data : [];
    },
    enabled: !!semesterId,
  });

  const sections = rawSections ?? [];

  // Fetch faculty
  const { data: rawFaculty, isLoading: loadingFaculty } = useQuery({
    queryKey: ["faculty-mappable"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultyData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/faculty`,
        { withCredentials: true }
      );
      return res.data.status === "success" && res.data.data ? res.data.data : [];
    },
  });

  const faculty = rawFaculty ?? [];

  // Fetch existing mapping for current course
  const { data: rawExistingMappings, isLoading: loadingExisting } = useQuery({
    queryKey: ["course-mapping", course.id, semesterId, academicYear],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CourseMappingByCourseItemType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/by-course`,
        {
          params: { courseId: course.id, semesterId, academicYear },
          withCredentials: true,
        }
      );
      return res.data.status === "success" && res.data.data ? res.data.data : [];
    },
    enabled: !!course.id && !!semesterId && !!academicYear,
  });

  const existingMappings = rawExistingMappings ?? [];

  const facultyOptions = useMemo(
    () =>
      faculty.map((f) => ({
        value: f.id,
        label: f.name,
        sublabel: isBasicSciences ? f.departmentAbbreviation : undefined,
      })),
    [faculty, isBasicSciences]
  );

  const [mappings, setMappings] = useState<SectionMappingState[]>([]);

  // Initialize mapping state when sections or existing mappings load
  useEffect(() => {
    if (loadingSections || loadingExisting) return;

    const initialState: SectionMappingState[] = sections.map((section) => {
      const existingTheory = existingMappings.find(
        (m) => m.sectionId === section.id && m.assignmentType === "THEORY"
      );

      const labBatches = DEFAULT_BATCHES.map((batchName) => {
        const existingLab = existingMappings.find(
          (m) =>
            m.sectionId === section.id &&
            m.assignmentType === "LAB" &&
            m.batchName === batchName
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
  }, [sections, existingMappings, loadingSections, loadingExisting]);

  const updateTheory = (sectionId: string, facultyId: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sectionId === sectionId ? { ...m, theoryFacultyId: facultyId } : m
      )
    );
  };

  const updateLab = (sectionId: string, batchName: string, facultyId: string | null) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.sectionId !== sectionId) return m;
        return {
          ...m,
          labFacultyByBatch: m.labFacultyByBatch.map((b) =>
            b.batchName === batchName ? { ...b, facultyId } : b
          ),
        };
      })
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        courseId: course.id,
        semesterId,
        academicYear,
        studentsPerLabBatch: 20, // default
        sectionMappings: mappings.map((m) => ({
          sectionId: m.sectionId,
          theoryFacultyId: hasTheory ? m.theoryFacultyId : null,
          labFacultyByBatch: hasLab
            ? m.labFacultyByBatch.filter((b) => b.facultyId !== null)
            : [],
        })),
      };

      return axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/upsert`,
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["course-mapping"] });
      queryClient.invalidateQueries({ queryKey: ["course-mapping-status"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to save mappings");
    },
  });

  const isLoading = loadingSections || loadingFaculty || loadingExisting;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (sections.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No sections found for this semester.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted leading-normal font-medium border-b">
            <tr>
              <th className="px-4 py-3 min-w-[100px] border-r border-border">Section</th>
              {hasTheory && (
                <th className="px-4 py-3 min-w-[200px] border-r border-border">Theory Faculty</th>
              )}
              {hasLab && DEFAULT_BATCHES.map((batch) => (
                <th key={batch} className="px-4 py-3 min-w-[200px] border-r border-border last:border-0 text-center">
                  Lab: {batch}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sections.map((section) => {
              const state = mappings.find((m) => m.sectionId === section.id);
              if (!state) return null;

              return (
                <tr key={section.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-4 py-4 font-medium border-r border-border bg-muted/20 group-hover:bg-muted/60">
                    {section.name}
                  </td>
                  
                  {hasTheory && (
                    <td className="px-4 border-r border-border">
                      <Combobox
                        options={facultyOptions}
                        value={state.theoryFacultyId}
                        onValueChange={(val) => updateTheory(section.id, val)}
                        placeholder="Select Theory Faculty"
                        className="bg-background"
                      />
                    </td>
                  )}
                  
                  {hasLab && DEFAULT_BATCHES.map((batchName) => {
                    const batchState = state.labFacultyByBatch.find((b) => b.batchName === batchName);
                    return (
                      <td key={batchName} className="px-4 border-r border-border last:border-0">
                        <Combobox
                          options={facultyOptions}
                          value={batchState?.facultyId ?? null}
                          onValueChange={(val) => updateLab(section.id, batchName, val)}
                          placeholder={`Select ${batchName} Faculty`}
                          className="bg-background text-xs"
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
          disabled={saveMutation.isPending}
          size="lg"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Mappings
        </Button>
      </div>
    </div>
  );
};
