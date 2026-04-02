"use client";

import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
import {
  GenerateSectionsDTO,
  GenerateSectionsSchema,
} from "@webcampus/schemas/department";
import { BaseResponse, SuccessResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import axios, { AxiosError, AxiosResponse } from "axios";
import { Wand2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
  useForm,
  useWatch,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "react-toastify";
import { useCreateCycleSectionsForm } from "./use-create-section-form";

type SectionCycle = "PHYSICS" | "CHEMISTRY";

interface UnassignedDepartmentCount {
  departmentId: string;
  departmentName: string;
  abbreviation: string;
  unassignedCount: number;
}

interface DetailedPreviewSection {
  sectionName: string;
  studentUsns: string[];
}

interface GenerateSectionsDialogProps {
  termId: string;
  semesterId: string;
  semesterNumber: number;
  cycle?: SectionCycle;
}

export const GenerateSectionsDialog = ({
  termId,
  semesterId,
  semesterNumber,
  cycle = "PHYSICS",
}: GenerateSectionsDialogProps) => {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const departmentName = session?.user?.name ?? "";

  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  const cycleFromParams = useMemo(() => {
    const paramCycle = searchParams.get("cycle");
    return paramCycle === "PHYSICS" || paramCycle === "CHEMISTRY"
      ? paramCycle
      : undefined;
  }, [searchParams]);

  const selectedCycle: SectionCycle = cycleFromParams ?? cycle;

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

  const { data: terms, isLoading: isLoadingTerms } = useQuery({
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

  const termOptions = Array.isArray(terms) ? terms : [];
  const selectedTerm = termOptions.find((t) => t.id === termId);
  const selectedSemester = selectedTerm?.Semester?.find(
    (s) => s.id === semesterId
  );

  const isBasicSciences = deptInfo?.type === "BASIC_SCIENCES";
  const isCycleMode =
    isBasicSciences && (semesterNumber === 1 || semesterNumber === 2);

  const isUgFirstYearReadOnly =
    deptInfo?.type !== "BASIC_SCIENCES" &&
    selectedSemester?.programType === "UG" &&
    (semesterNumber === 1 || semesterNumber === 2);

  const standardForm = useForm<GenerateSectionsDTO>({
    resolver: zodResolver(GenerateSectionsSchema),
    defaultValues: {
      semesterId: "",
      departmentName,
      studentsPerSection: 60,
      academicYear: "",
    },
  });

  useEffect(() => {
    if (!departmentName) {
      return;
    }
    standardForm.setValue("departmentName", departmentName);
  }, [departmentName, standardForm]);

  useEffect(() => {
    standardForm.setValue("semesterId", semesterId);
    standardForm.setValue("academicYear", selectedTerm?.year ?? "");
  }, [semesterId, selectedTerm?.year, standardForm]);

  const cycleSectionForm = useCreateCycleSectionsForm({
    termId,
    semesterId,
    semesterNumber,
    cycle: selectedCycle,
    academicYear: selectedTerm?.year ?? "",
  });

  const {
    data: unassignedCounts,
    isLoading: isLoadingUnassignedCounts,
    isFetching: isFetchingUnassignedCounts,
    isError: isUnassignedCountsError,
  } = useQuery({
    queryKey: ["unassigned-counts", termId, semesterNumber],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<UnassignedDepartmentCount[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/unassigned-counts`,
        {
          params: { termId, semesterNumber },
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return [] as UnassignedDepartmentCount[];
    },
    enabled: isCycleMode && !!termId && !!semesterNumber,
  });

  useEffect(() => {
    if (!isCycleMode || !unassignedCounts) {
      return;
    }
    cycleSectionForm.syncAllocations(unassignedCounts);
  }, [isCycleMode, unassignedCounts]);

  const { data: unassignedData } = useQuery({
    queryKey: ["unassigned-count", semesterId, departmentName],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{ count: number; semesterNumber: number }>
      >(`${NEXT_PUBLIC_API_BASE_URL}/department/section/unassigned-count`, {
        params: { semesterId, departmentName },
        withCredentials: true,
      });
      if (res.data.status === "success") return res.data.data;
      return { count: 0, semesterNumber: 0 };
    },
    enabled: !isCycleMode && !!semesterId && !!departmentName,
  });

  const standardStudentsPerSection = standardForm.watch("studentsPerSection");
  const unassignedCount = unassignedData?.count ?? 0;
  const previewSemesterNumber =
    unassignedData?.semesterNumber ?? semesterNumber;

  const standardPreview = useMemo(() => {
    if (
      !standardStudentsPerSection ||
      standardStudentsPerSection <= 0 ||
      unassignedCount === 0
    ) {
      return [] as { name: string; count: number }[];
    }

    const numSections = Math.ceil(unassignedCount / standardStudentsPerSection);
    const sections: { name: string; count: number }[] = [];
    for (let i = 0; i < numSections; i++) {
      const remaining = unassignedCount - i * standardStudentsPerSection;
      sections.push({
        name: `${previewSemesterNumber}${String.fromCharCode(65 + i)}`,
        count: Math.min(standardStudentsPerSection, remaining),
      });
    }
    return sections;
  }, [previewSemesterNumber, standardStudentsPerSection, unassignedCount]);

  const allocationValues = useWatch({
    control: cycleSectionForm.form.control,
    name: "allocations",
  });
  const cycleStudentsPerSection = useWatch({
    control: cycleSectionForm.form.control,
    name: "studentsPerSection",
  });

  const totalSelectedStudents = useMemo(() => {
    if (!Array.isArray(allocationValues)) {
      return 0;
    }
    return allocationValues.reduce((sum, allocation) => {
      if (!allocation || !allocation.selected || allocation.count <= 0) {
        return sum;
      }
      return sum + (allocation.count || 0);
    }, 0);
  }, [allocationValues]);

  const cycleSectionsPreview = useMemo(() => {
    if (!cycleStudentsPerSection || cycleStudentsPerSection <= 0) {
      return 0;
    }
    if (!totalSelectedStudents || totalSelectedStudents <= 0) {
      return 0;
    }
    return Math.ceil(totalSelectedStudents / cycleStudentsPerSection);
  }, [cycleStudentsPerSection, totalSelectedStudents]);

  const selectedAllocations = useMemo(
    () =>
      (allocationValues ?? [])
        .filter((allocation) => allocation?.selected && allocation.count > 0)
        .map((allocation) => ({
          departmentId: allocation.departmentId,
          count: allocation.count,
          selected: true,
        })),
    [allocationValues]
  );

  const hasSelectedAllocations = selectedAllocations.length > 0;

  const {
    data: detailedPreviewSections,
    isFetching: isFetchingDetailedPreview,
    isError: isDetailedPreviewError,
    error: detailedPreviewError,
  } = useQuery({
    queryKey: [
      "detailed-generation-preview",
      semesterId,
      selectedCycle,
      cycleStudentsPerSection,
      selectedAllocations,
    ],
    queryFn: async () => {
      const res = await axios.post<BaseResponse<DetailedPreviewSection[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/preview-sections`,
        {
          semesterId,
          cycle: selectedCycle,
          studentsPerSection: cycleStudentsPerSection,
          allocations: selectedAllocations,
        },
        { withCredentials: true }
      );

      if (res.data.status === "success") {
        return res.data.data;
      }

      return [] as DetailedPreviewSection[];
    },
    enabled:
      open &&
      isCycleMode &&
      !!semesterId &&
      cycleStudentsPerSection > 0 &&
      hasSelectedAllocations,
  });

  const standardMutation = useMutation({
    mutationFn: async (values: GenerateSectionsDTO) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/generate`,
        values,
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<unknown>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["sections-with-students"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-count"] });
      setOpen(false);
      standardForm.reset({
        semesterId,
        departmentName,
        studentsPerSection: 60,
        academicYear: selectedTerm?.year ?? "",
      });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(error.response?.data?.error || "Failed to generate sections");
    },
  });

  useEffect(() => {
    if (!cycleSectionForm.generateCycleMutation.isSuccess) {
      return;
    }

    setOpen(false);
    cycleSectionForm.generateCycleMutation.reset();
  }, [cycleSectionForm.generateCycleMutation]);

  const isPending =
    standardMutation.isPending ||
    cycleSectionForm.generateCycleMutation.isPending;

  const handleStandardSubmit = (values: GenerateSectionsDTO) => {
    standardMutation.mutate({ ...values, departmentName });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Sections
        </Button>
      </DialogTrigger>
      <DialogContent
        className={
          isCycleMode
            ? "max-h-[90vh] overflow-hidden sm:max-w-3xl"
            : "sm:max-w-lg"
        }
      >
        <Form
          {...((isCycleMode
            ? cycleSectionForm.form
            : standardForm) as unknown as UseFormReturn<FieldValues>)}
        >
          <form
            onSubmit={
              isCycleMode
                ? (event) => {
                    event.preventDefault();
                    cycleSectionForm.onSubmit();
                  }
                : standardForm.handleSubmit(handleStandardSubmit)
            }
            className={
              isCycleMode
                ? "flex max-h-[calc(90vh-7rem)] flex-col"
                : "space-y-4"
            }
          >
            <DialogHeader className={isCycleMode ? "shrink-0 pb-4" : ""}>
              <DialogTitle>Generate Sections</DialogTitle>
            </DialogHeader>

            {isCycleMode ? (
              <>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                  <div className="bg-muted rounded-md p-3 text-sm">
                    <p>
                      Academic Term:{" "}
                      <strong>{selectedTerm?.year ?? "--"}</strong>
                    </p>
                    <p>
                      Semester:{" "}
                      <strong>
                        {selectedSemester?.programType ?? "--"} -{" "}
                        {semesterNumber}
                      </strong>
                    </p>
                    <p>
                      Cycle: <strong>{selectedCycle}</strong>
                    </p>
                  </div>

                  {isUgFirstYearReadOnly ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <strong>403 Unauthorized:</strong> First-year sections are
                      managed by the Basic Sciences department.
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Department Allocation
                    </p>
                    <div className="max-h-[28vh] space-y-2 overflow-y-auto rounded-md border p-2 md:max-h-[30vh]">
                      {isLoadingUnassignedCounts ||
                      isFetchingUnassignedCounts ? (
                        <div className="bg-muted rounded-md p-3 text-sm">
                          Loading department unassigned counts...
                        </div>
                      ) : isUnassignedCountsError ? (
                        <div className="bg-muted rounded-md p-3 text-sm">
                          Failed to load department counts. Please retry.
                        </div>
                      ) : (unassignedCounts ?? []).length === 0 ? (
                        <div className="bg-muted rounded-md p-3 text-sm">
                          No departments found for allocation.
                        </div>
                      ) : (
                        (unassignedCounts ?? []).map((department, index) => {
                          const row = allocationValues?.[index];
                          const isDisabled = department.unassignedCount === 0;

                          return (
                            <div
                              key={department.departmentId}
                              className="bg-muted grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md p-3"
                            >
                              <Button
                                type="button"
                                variant={row?.selected ? "default" : "outline"}
                                className={
                                  row?.selected
                                    ? "bg-green-600 text-white hover:bg-green-600/90"
                                    : undefined
                                }
                                disabled={isDisabled}
                                onClick={() => {
                                  cycleSectionForm.form.setValue(
                                    `allocations.${index}.selected`,
                                    !row?.selected
                                  );
                                }}
                              >
                                {department.abbreviation}
                              </Button>

                              <div className="text-sm">
                                <p className="font-medium">
                                  {department.departmentName}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  Unassigned: {department.unassignedCount}
                                </p>
                              </div>

                              <Input
                                type="number"
                                min={0}
                                max={department.unassignedCount}
                                value={row?.count ?? 0}
                                className="w-24"
                                onChange={(event) => {
                                  const raw = parseInt(event.target.value, 10);
                                  const safeValue = Number.isNaN(raw)
                                    ? 0
                                    : Math.max(
                                        0,
                                        Math.min(
                                          raw,
                                          department.unassignedCount
                                        )
                                      );
                                  cycleSectionForm.form.setValue(
                                    `allocations.${index}.count`,
                                    safeValue
                                  );
                                }}
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <FormField
                    control={cycleSectionForm.form.control}
                    name="studentsPerSection"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Students Per Section</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="200"
                            value={field.value}
                            onChange={(event) => {
                              field.onChange(
                                parseInt(event.target.value, 10) || 0
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted rounded-md p-3 text-sm">
                    <p>
                      Preview: <strong>{totalSelectedStudents}</strong> /{" "}
                      <strong>{cycleStudentsPerSection || 0}</strong> ={" "}
                      <strong>{cycleSectionsPreview}</strong> section(s)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Detailed Preview
                    </p>

                    {!hasSelectedAllocations ? (
                      <div className="bg-muted rounded-md p-3 text-sm">
                        Select at least one department and set a count to
                        preview sections.
                      </div>
                    ) : isFetchingDetailedPreview ? (
                      <div className="bg-muted rounded-md p-3 text-sm">
                        Loading section preview...
                      </div>
                    ) : isDetailedPreviewError ? (
                      <div className="bg-muted rounded-md p-3 text-sm text-red-600">
                        {axios.isAxiosError(detailedPreviewError)
                          ? detailedPreviewError.response?.data?.message ||
                            detailedPreviewError.response?.data?.error ||
                            "Failed to load detailed preview. Please retry."
                          : "Failed to load detailed preview. Please retry."}
                      </div>
                    ) : detailedPreviewSections &&
                      detailedPreviewSections.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {detailedPreviewSections.map((section) => (
                          <div
                            key={section.sectionName}
                            className="bg-muted rounded-md p-3"
                          >
                            <p className="mb-2 text-sm font-semibold">
                              Section {section.sectionName}
                            </p>
                            <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                              {section.studentUsns.length > 0 ? (
                                section.studentUsns.map((usn) => (
                                  <p
                                    key={`${section.sectionName}-${usn}`}
                                    className="font-mono text-xs"
                                  >
                                    {usn}
                                  </p>
                                ))
                              ) : (
                                <p className="text-muted-foreground text-xs">
                                  No students in this section
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-muted rounded-md p-3 text-sm">
                        No eligible students found for the selected allocations
                        in this semester.
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="shrink-0 pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  {isUgFirstYearReadOnly ? (
                    <Button type="button" disabled>
                      Restricted (Managed by Basic Sciences)
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={
                        isPending ||
                        !semesterId ||
                        isLoadingTerms ||
                        (isCycleMode && totalSelectedStudents === 0)
                      }
                    >
                      {isPending
                        ? "Generating..."
                        : isCycleMode
                          ? `Generate ${cycleSectionsPreview} Sections`
                          : `Generate ${standardPreview.length} Sections`}
                    </Button>
                  )}
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="bg-muted rounded-md p-3 text-sm">
                  <p>
                    Academic Term: <strong>{selectedTerm?.year ?? "--"}</strong>
                  </p>
                  <p>
                    Semester:{" "}
                    <strong>
                      {selectedSemester?.programType ?? "--"} - {semesterNumber}
                    </strong>
                  </p>
                </div>

                {isUgFirstYearReadOnly ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <strong>403 Unauthorized:</strong> First-year sections are
                    managed by the Basic Sciences department.
                  </div>
                ) : null}

                <FormField
                  control={standardForm.control}
                  name="studentsPerSection"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Students per Section</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="200"
                          {...field}
                          onChange={(event) => {
                            field.onChange(
                              parseInt(event.target.value, 10) || 0
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted rounded-md p-3">
                  <p className="text-sm">
                    Unassigned students:{" "}
                    <Badge variant="secondary" className="ml-1">
                      {unassignedCount}
                    </Badge>
                  </p>
                </div>

                {standardPreview.length > 0 ? (
                  <div className="bg-muted space-y-1 rounded-md p-3">
                    <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                      Preview ({standardPreview.length} sections)
                    </p>
                    {standardPreview.map((section) => (
                      <div
                        key={section.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-mono font-medium">
                          Section {section.name}
                        </span>
                        <Badge variant="outline">
                          {section.count} students
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  {isUgFirstYearReadOnly ? (
                    <Button type="button" disabled>
                      Restricted (Managed by Basic Sciences)
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={
                        isPending ||
                        !semesterId ||
                        isLoadingTerms ||
                        (isCycleMode && totalSelectedStudents === 0)
                      }
                    >
                      {isPending
                        ? "Generating..."
                        : isCycleMode
                          ? `Generate ${cycleSectionsPreview} Sections`
                          : `Generate ${standardPreview.length} Sections`}
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
