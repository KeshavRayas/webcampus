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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Combobox } from "@webcampus/ui/molecules/combobox";
import axios, { AxiosError } from "axios";
import { CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  ALL_SECTIONS,
  filterMappingsBySection,
  getSectionOptions,
  SectionFilterMapping,
} from "./section-filter";

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
  isLocked?: boolean;
  isAdmin?: boolean;
}

type SectionMappingState = {
  sectionId: string;
  theoryFacultyId: string | null;
  labFacultyByBatch: { batchName: string; facultyId: string | null }[];
};

type PeBatchMappingState = SectionFilterMapping;

const DEFAULT_BATCHES = ["L1", "L2", "L3", "L4"];

export const CourseMappingGrid = ({
  course,
  semesterId,
  academicYear,
  cycle,
  isLocked = false,
  isAdmin = false,
}: CourseMappingGridProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBatchManaged =
    course.courseType === "PE" ||
    course.courseType === "OE" ||
    course.courseType === "PW";
  const isPw = course.courseType === "PW";
  const isDepartmentWidePw =
    isPw && course.projectGroupingScope === "DEPARTMENT_WIDE";

  const isVisuallyLocked = isLocked && !isAdmin;
  const isSuperEdit = isLocked && isAdmin;

  const hasTheory = ["INTEGRATED", "NON_INTEGRATED", "NCMC"].includes(
    course.courseMode
  );
  const hasLab = ["INTEGRATED", "FINAL_SUMMARY"].includes(course.courseMode);

  const assignmentBase = isAdmin
    ? `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment`
    : `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment`;

  // Fetch sections (PC only)
  const { data: rawSections, isLoading: loadingSections } = useQuery({
    queryKey: ["sections", semesterId, cycle],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SectionData[]>>(
        `${assignmentBase}/sections`,
        { params: { semesterId, cycle }, withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!semesterId && !isBatchManaged,
  });

  const sections = useMemo(() => rawSections ?? [], [rawSections]);

  // Fetch faculty. Batch-managed courses (PE/OE/PW) allow mapping faculty
  // from any department.
  const { data: rawFaculty, isLoading: loadingFaculty } = useQuery({
    queryKey: ["faculty-mappable", isBatchManaged ? "batch" : "department"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultyData[]>>(
        `${assignmentBase}/faculty`,
        {
          params: isBatchManaged ? { scope: "batch" } : {},
          withCredentials: true,
        }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
  });

  const faculty = useMemo(() => rawFaculty ?? [], [rawFaculty]);

  // Fetch existing mapping for current course
  const { data: rawExistingMappings, isLoading: loadingExisting } = useQuery({
    queryKey: ["course-mapping", course.id, semesterId, academicYear],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<CourseMappingByCourseItemType[]>
      >(`${assignmentBase}/by-course`, {
        params: {
          courseId: course.id,
          semesterId,
          academicYear,
          ...(isAdmin ? { departmentId: course.departmentId } : {}),
        },
        withCredentials: true,
      });
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!course.id && !!semesterId && !!academicYear,
  });

  const existingMappings = useMemo(
    () => rawExistingMappings ?? [],
    [rawExistingMappings]
  );

  const facultyOptions = useMemo(
    () =>
      faculty.map((f) => ({
        value: f.id,
        label: f.name,
        sublabel: f.departmentAbbreviation,
      })),
    [faculty]
  );

  const [mappings, setMappings] = useState<SectionMappingState[]>([]);
  const [peMappings, setPeMappings] = useState<PeBatchMappingState[]>([]);
  const [sectionFilter, setSectionFilter] = useState(ALL_SECTIONS);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);

  const sectionOptions = useMemo(() => {
    if (!isPw || course.projectGroupingScope !== "WITHIN_SECTION") return [];
    return getSectionOptions(peMappings);
  }, [isPw, course.projectGroupingScope, peMappings]);

  const visiblePeMappings = useMemo(
    () => filterMappingsBySection(peMappings, sectionFilter),
    [peMappings, sectionFilter]
  );

  useEffect(() => {
    if (isBatchManaged) {
      if (loadingExisting) return;
      setPeMappings(
        existingMappings
          .filter((m) => m.electiveBatchId)
          .map((m) => ({
            electiveBatchId: m.electiveBatchId!,
            electiveBatchName: m.electiveBatchName ?? "",
            sectionName: m.sectionName ?? null,
            facultyId: m.facultyId || m.proposedFacultyId || null,
            proposedFacultyId: m.proposedFacultyId || null,
          }))
      );
      return;
    }

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
  }, [
    isBatchManaged,
    sections,
    existingMappings,
    loadingSections,
    loadingExisting,
  ]);

  const updateTheory = (sectionId: string, facultyId: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sectionId === sectionId ? { ...m, theoryFacultyId: facultyId } : m
      )
    );
  };

  const updateLab = (
    sectionId: string,
    batchName: string,
    facultyId: string | null
  ) => {
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

  // --- Excel Handlers ---
  const handleDownloadExcel = async () => {
    try {
      const res = await axios.get(`${assignmentBase}/excel/download`, {
        params: { courseId: course.id, semesterId, academicYear },
        responseType: "blob",
        withCredentials: true,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${course.code}_Mapping_Template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      toast.error("Failed to download Excel template");
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${assignmentBase}/excel/upload`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const extractedData = res.data.data.extractedData as {
        section: string;
        facultyName: string;
      }[];

      setMappings((prev) => {
        // Deep clone to safely mutate nested arrays
        const next = prev.map((mapping) => ({
          ...mapping,
          labFacultyByBatch: [...mapping.labFacultyByBatch],
        }));

        extractedData.forEach(({ section: rowLabel, facultyName }) => {
          // Clean the faculty name to match combobox options exactly
          const cleanFacName = facultyName?.trim();
          const facId =
            facultyOptions.find((f) => f.label.trim() === cleanFacName)
              ?.value ?? null;

          // Check if the row label matches a Section Name (for Theory)
          const matchedSection = sections.find((s) => s.name === rowLabel);

          if (matchedSection && hasTheory) {
            const targetMapping = next.find(
              (m) => m.sectionId === matchedSection.id
            );
            if (targetMapping) {
              targetMapping.theoryFacultyId = facId;
            }
          }
          // If not a section, check if the row label matches a Batch Name (for Lab)
          else if (hasLab) {
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

      toast.success("Excel data populated! Please review before saving.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse Excel file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const payload: Record<string, unknown> = isBatchManaged
        ? {
            courseId: course.id,
            semesterId,
            academicYear,
            isSuperEdit,
            electiveBatchMappings: peMappings.map((m) => ({
              electiveBatchId: m.electiveBatchId,
              facultyId: m.facultyId,
            })),
            ...(isAdmin ? { departmentId: course.departmentId } : {}),
          }
        : {
            courseId: course.id,
            semesterId,
            academicYear,
            isSuperEdit,
            studentsPerLabBatch: 20,
            sectionMappings: mappings.map((m) => ({
              sectionId: m.sectionId,
              theoryFacultyId: hasTheory ? m.theoryFacultyId : null,
              labFacultyByBatch: hasLab
                ? m.labFacultyByBatch.filter((b) => b.facultyId !== null)
                : [],
            })),
            ...(isAdmin ? { departmentId: course.departmentId } : {}),
          };

      if (reason) {
        payload.reason = reason;
      }

      return axios.post(`${assignmentBase}/upsert`, payload, {
        withCredentials: true,
      });
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      setLastSaved(new Date().toLocaleTimeString());
      queryClient.invalidateQueries({ queryKey: ["course-mapping"] });
      queryClient.invalidateQueries({ queryKey: ["course-mapping-status"] });
      queryClient.invalidateQueries({
        queryKey: ["department-courses-approvals"],
      });
    },
    onError: (err) => {
      console.error(err);
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message
          : "Failed to save mappings";
      toast.error(message || "Failed to save mappings");
    },
  });

  const handleSaveClick = () => {
    if (isSuperEdit) {
      setShowReasonDialog(true);
    } else {
      saveMutation.mutate(undefined);
    }
  };

  const handleReasonConfirm = (reason: string) => {
    setShowReasonDialog(false);
    saveMutation.mutate(reason);
  };

  if (
    loadingFaculty ||
    loadingExisting ||
    (!isBatchManaged && loadingSections)
  ) {
    return (
      <div className="text-muted-foreground flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (isBatchManaged) {
    return (
      <div className="space-y-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {isPw
              ? "Project Group Faculty Assignments"
              : "Elective Batch Faculty Assignments"}
          </h3>
          <div className="flex items-center gap-3">
            {sectionOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Section</span>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger size="sm" className="min-w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SECTIONS}>All Sections</SelectItem>
                    {sectionOptions.map((sectionName) => (
                      <SelectItem key={sectionName} value={sectionName}>
                        {sectionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {lastSaved && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <CheckCircle2 className="size-3.5" /> Saved {lastSaved}
              </span>
            )}
          </div>
        </div>
        {isDepartmentWidePw && (
          <p className="text-muted-foreground text-xs">
            Proposed balanced distribution shown below. Review or override any
            assignment, then save Course Mapping to commit.
          </p>
        )}
        {peMappings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No elective batches configured for this batch-managed course.
          </p>
        ) : (
          <>
            {sectionOptions.length > 0 && sectionFilter !== ALL_SECTIONS && (
              <p className="text-muted-foreground text-xs">
                Showing {visiblePeMappings.length} of {peMappings.length} groups
                for {sectionFilter}.
              </p>
            )}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted border-b font-medium">
                  <tr>
                    <th className="border-border min-w-40 border-r px-4 py-3">
                      {isPw ? "Group" : "Elective Batch"}
                    </th>
                    {isPw && (
                      <th className="border-border border-r px-4 py-3">
                        Section
                      </th>
                    )}
                    <th className="px-4 py-3">Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePeMappings.map((row) => (
                    <tr key={row.electiveBatchId} className="border-t">
                      <td className="border-border border-r px-4 py-3 font-medium">
                        {row.electiveBatchName}
                      </td>
                      {isPw && (
                        <td className="border-border border-r px-4 py-3">
                          {row.sectionName ?? "—"}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Combobox
                          options={facultyOptions}
                          value={row.facultyId}
                          onValueChange={(value) =>
                            setPeMappings((prev) =>
                              prev.map((m) =>
                                m.electiveBatchId === row.electiveBatchId
                                  ? { ...m, facultyId: value }
                                  : m
                              )
                            )
                          }
                          placeholder="Select faculty"
                          disabled={isVisuallyLocked}
                          className="min-w-50 w-full"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveClick}
            disabled={isVisuallyLocked || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Save {isPw ? "Project Group Mapping" : "Batch Mapping"}
          </Button>
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        No sections found for this semester.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Faculty Assignments</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
            <input
              type="file"
              accept=".xlsx"
              ref={fileInputRef}
              className="hidden"
              onChange={handleExcelUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isVisuallyLocked}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Excel
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted border-b font-medium leading-normal">
              <tr>
                <th className="border-border min-w-25 border-r px-4 py-3">
                  Section
                </th>
                {hasTheory && (
                  <th className="border-border min-w-50 border-r px-4 py-3">
                    Theory Faculty
                  </th>
                )}
                {hasLab &&
                  DEFAULT_BATCHES.map((batch) => (
                    <th
                      key={batch}
                      className="border-border min-w-50 border-r px-4 py-3 text-center last:border-0"
                    >
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
                  <tr
                    key={section.id}
                    className="hover:bg-muted/50 group transition-colors"
                  >
                    <td className="border-border bg-muted/20 group-hover:bg-muted/60 border-r px-4 py-4 font-medium">
                      {section.name}
                    </td>
                    {hasTheory && (
                      <td className="border-border border-r px-4">
                        <Combobox
                          options={facultyOptions}
                          value={state.theoryFacultyId}
                          onValueChange={(val) => updateTheory(section.id, val)}
                          placeholder="Select Theory Faculty"
                          className="bg-background"
                          disabled={isVisuallyLocked}
                        />
                      </td>
                    )}
                    {hasLab &&
                      DEFAULT_BATCHES.map((batchName) => {
                        const batchState = state.labFacultyByBatch.find(
                          (b) => b.batchName === batchName
                        );
                        return (
                          <td
                            key={batchName}
                            className="border-border border-r px-4 last:border-0"
                          >
                            <Combobox
                              options={facultyOptions}
                              value={batchState?.facultyId ?? null}
                              onValueChange={(val) =>
                                updateLab(section.id, batchName, val)
                              }
                              placeholder={`Select ${batchName} Faculty`}
                              className="bg-background text-xs"
                              disabled={isVisuallyLocked}
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

        <div className="flex items-center justify-end gap-4 pt-4">
          {lastSaved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved at {lastSaved}
            </span>
          )}
          <Button
            onClick={handleSaveClick}
            disabled={saveMutation.isPending || isVisuallyLocked}
            size="lg"
            className={
              lastSaved ? "ring-2 ring-emerald-500/30 ring-offset-2" : ""
            }
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {isSuperEdit ? "Super Edit & Save" : "Save Mappings"}
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
