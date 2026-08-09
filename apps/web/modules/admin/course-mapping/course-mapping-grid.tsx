"use client";

import { ReasonDialog } from "@/components/admin/reason-dialog";
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
  departmentId: string;
  departmentName: string;
  semesterId: string;
  academicYear: string;
  cycle: string;
  isBasicSciences: boolean;
  isLocked?: boolean;
  excelExtractedData?: { section: string; facultyName: string }[] | null;
  onExcelDataConsumed?: () => void;
}

type SectionMappingState = {
  sectionId: string;
  theoryFacultyId: string | null;
  labFacultyByBatch: { batchName: string; facultyId: string | null }[];
};

type PeBatchMappingState = {
  electiveBatchId: string;
  electiveBatchName: string;
  facultyId: string | null;
};

const DEFAULT_BATCHES = ["L1", "L2", "L3", "L4"];

export const AdminCourseMappingGrid = ({
  course,
  departmentId,
  departmentName,
  semesterId,
  academicYear,
  cycle,
  isBasicSciences,
  isLocked = false,
  excelExtractedData,
  onExcelDataConsumed,
}: AdminCourseMappingGridProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const isPe = course.courseType === "PE" || course.courseType === "OE";

  const hasSectionFaculty =
    (course.lectureCredits ?? 0) > 0 || (course.tutorialCredits ?? 0) > 0;
  const hasLab = (course.practicalCredits ?? 0) > 0;

  const { data: rawSections, isLoading: loadingSections } = useQuery({
    queryKey: ["admin-mapping-sections", departmentId, semesterId, cycle],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SectionData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/sections`,
        {
          params: { semesterId, departmentId, departmentName, cycle },
          withCredentials: true,
        }
      );

      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!departmentId && !!semesterId && !isPe,
  });

  const sections = useMemo(() => rawSections ?? [], [rawSections]);

  const { data: rawFaculty, isLoading: loadingFaculty } = useQuery({
    queryKey: ["admin-mapping-faculty", departmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultyData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/faculty`,
        {
          params: { departmentId, departmentName },
          withCredentials: true,
        }
      );

      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!departmentId,
  });

  const faculty = useMemo(() => rawFaculty ?? [], [rawFaculty]);

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
          departmentId,
          departmentName,
        },
        withCredentials: true,
      });

      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!course.id && !!semesterId && !!academicYear && !!departmentId,
  });

  const existingMappings = useMemo(
    () => rawExistingMappings ?? [],
    [rawExistingMappings]
  );

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
  const [peMappings, setPeMappings] = useState<PeBatchMappingState[]>([]);
  const [showReasonDialog, setShowReasonDialog] = useState(false);

  useEffect(() => {
    if (isPe) {
      if (loadingExisting) {
        return;
      }

      setPeMappings(
        existingMappings
          .filter((mapping) => mapping.electiveBatchId)
          .map((mapping) => ({
            electiveBatchId: mapping.electiveBatchId!,
            electiveBatchName: mapping.electiveBatchName ?? "",
            facultyId: mapping.facultyId || null,
          }))
      );
      return;
    }

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
  }, [existingMappings, loadingExisting, loadingSections, sections, isPe]);

  // Apply extracted Excel data to mappings when received
  useEffect(() => {
    if (!excelExtractedData || excelExtractedData.length === 0) return;

    setMappings((prev) => {
      const next = prev.map((mapping) => ({
        ...mapping,
        labFacultyByBatch: [...mapping.labFacultyByBatch],
      }));

      excelExtractedData.forEach(({ section: rowLabel, facultyName }) => {
        const cleanFacName = facultyName?.trim();
        const facId =
          facultyOptions.find((f) => f.label.trim() === cleanFacName)?.value ??
          null;

        const matchedSection = sections.find((s) => s.name === rowLabel);

        if (matchedSection && hasSectionFaculty) {
          const targetMapping = next.find(
            (m) => m.sectionId === matchedSection.id
          );
          if (targetMapping) {
            targetMapping.theoryFacultyId = facId;
          }
        } else if (hasLab) {
          next.forEach((m) => {
            const targetBatch = m.labFacultyByBatch.find(
              (b) => b.batchName === rowLabel
            );
            if (targetBatch) {
              targetBatch.facultyId = facId;
            }
          });
        }
      });
      return next;
    });

    onExcelDataConsumed?.();
  }, [excelExtractedData]);

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

  const updatePeFaculty = (
    electiveBatchId: string,
    facultyId: string | null
  ) => {
    setPeMappings((prev) =>
      prev.map((m) =>
        m.electiveBatchId === electiveBatchId ? { ...m, facultyId } : m
      )
    );
  };

  const doSave = (reason?: string) => {
    const payload: Record<string, unknown> = isPe
      ? {
          courseId: course.id,
          departmentId,
          departmentName,
          semesterId,
          academicYear,
          isSuperEdit: isLocked,
          electiveBatchMappings: peMappings.map((mapping) => ({
            electiveBatchId: mapping.electiveBatchId,
            facultyId: mapping.facultyId,
          })),
        }
      : {
          courseId: course.id,
          departmentId,
          departmentName,
          semesterId,
          academicYear,
          studentsPerLabBatch: 15,
          version: course.version,
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

    if (reason) {
      payload.reason = reason;
    }

    return axios.post(
      `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/upsert`,
      payload,
      { withCredentials: true }
    );
  };

  const saveMutation = useMutation({
    mutationFn: async (reason?: string) => doSave(reason),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-course-mapping"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-course-mapping-status"],
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError && error.response?.status === 409) {
        toast.error(
          "This course has been modified by another administrator. Please refresh the page."
        );
        queryClient.invalidateQueries({ queryKey: ["admin-course-mapping"] });
        return;
      }
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message
          : "Failed to save mappings";
      toast.error(message || "Failed to save mappings");
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

  const isLoading = loadingSections || loadingFaculty || loadingExisting;

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (isPe) {
    return (
      <>
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">
            Elective Batch Faculty Assignments
          </h3>
          {peMappings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No elective batches configured for this batch-managed course.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted border-b font-medium">
                  <tr>
                    <th className="border-border min-w-40 border-r px-4 py-3">
                      Elective Batch
                    </th>
                    <th className="px-4 py-3">Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {peMappings.map((row) => (
                    <tr key={row.electiveBatchId} className="border-t">
                      <td className="border-border border-r px-4 py-3 font-medium">
                        {row.electiveBatchName}
                      </td>
                      <td className="px-4 py-3">
                        <Combobox
                          options={facultyOptions}
                          value={row.facultyId}
                          onValueChange={(value) =>
                            updatePeFaculty(row.electiveBatchId, value)
                          }
                          placeholder="Select faculty"
                          className="min-w-50 w-full"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveClick} disabled={saveMutation.isPending}>
              {saveMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {isLocked
                ? "Super Edit & Save Batch Mapping"
                : "Save Batch Mapping"}
            </Button>
          </div>
        </div>

        <ReasonDialog
          open={showReasonDialog}
          onOpenChange={setShowReasonDialog}
          onConfirm={handleReasonConfirm}
          isRequired={true}
        />
      </>
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
    <>
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
            onClick={handleSaveClick}
            disabled={saveMutation.isPending}
            size="lg"
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save Mappings
          </Button>
        </div>
      </div>

      <ReasonDialog
        open={showReasonDialog}
        onOpenChange={setShowReasonDialog}
        onConfirm={handleReasonConfirm}
        isRequired={true}
      />
    </>
  );
};
