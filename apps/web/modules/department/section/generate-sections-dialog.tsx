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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import axios, { AxiosError, AxiosResponse } from "axios";
import { Wand2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const GenerateSectionsDialog = () => {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const departmentName = session?.user?.name ?? "";

  const [open, setOpen] = useState(false);
  const [dialogTermId, setDialogTermId] = useState<string>("");

  const form = useForm<GenerateSectionsDTO>({
    resolver: zodResolver(GenerateSectionsSchema),
    defaultValues: {
      semesterId: "",
      departmentName,
      studentsPerSection: 60,
      academicYear: "",
    },
  });

  // Sync departmentName from session whenever it loads/changes
  useEffect(() => {
    if (departmentName) {
      form.setValue("departmentName", departmentName);
    }
  }, [departmentName, form]);

  const selectedSemesterId = form.watch("semesterId");
  const studentsPerSection = form.watch("studentsPerSection");

  // Fetch academic terms for cascading dropdown
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
  const selectedTerm = termOptions.find((t) => t.id === dialogTermId);
  const nestedSemesters = selectedTerm?.Semester || [];

  // Fetch unassigned student count when semester is selected
  const { data: unassignedData } = useQuery({
    queryKey: ["unassigned-count", selectedSemesterId, departmentName],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{ count: number; semesterNumber: number }>
      >(`${NEXT_PUBLIC_API_BASE_URL}/department/section/unassigned-count`, {
        params: { semesterId: selectedSemesterId, departmentName },
        withCredentials: true,
      });
      if (res.data.status === "success") return res.data.data;
      return { count: 0, semesterNumber: 0 };
    },
    enabled: !!selectedSemesterId && !!departmentName,
  });

  const unassignedCount = unassignedData?.count ?? 0;
  const semesterNumber = unassignedData?.semesterNumber ?? 0;

  // Live preview computation
  const preview = useMemo(() => {
    if (!studentsPerSection || studentsPerSection <= 0 || unassignedCount === 0)
      return [];

    const numSections = Math.ceil(unassignedCount / studentsPerSection);
    const sections: { name: string; count: number }[] = [];

    for (let i = 0; i < numSections; i++) {
      const remaining = unassignedCount - i * studentsPerSection;
      sections.push({
        name: `${semesterNumber}${String.fromCharCode(65 + i)}`,
        count: Math.min(studentsPerSection, remaining),
      });
    }
    return sections;
  }, [studentsPerSection, unassignedCount, semesterNumber]);

  const generateMutation = useMutation({
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
      form.reset();
      setDialogTermId("");
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(error.response?.data?.error || "Failed to generate sections");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Sections
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              generateMutation.mutate({
                ...values,
                departmentName,
              })
            )}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Generate Sections</DialogTitle>
            </DialogHeader>

            {/* Term Selection */}
            <div className="space-y-2">
              <FormLabel>Academic Term</FormLabel>
              <Select
                value={dialogTermId}
                onValueChange={(value) => {
                  setDialogTermId(value);
                  form.setValue("semesterId", "");
                  // Auto-set academic year from term
                  const term = termOptions.find((t) => t.id === value);
                  if (term) {
                    form.setValue("academicYear", term.year);
                  }
                }}
                disabled={isLoadingTerms}
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

            {/* Semester Selection */}
            <FormField
              control={form.control}
              name="semesterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Semester</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!dialogTermId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select semester..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {nestedSemesters.map((semester) => (
                        <SelectItem key={semester.id} value={semester.id}>
                          {semester.programType} - Semester{" "}
                          {semester.semesterNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unassigned count display */}
            {selectedSemesterId && (
              <div className="bg-muted rounded-md p-3">
                <p className="text-sm">
                  Unassigned students:{" "}
                  <Badge variant="secondary" className="ml-1">
                    {unassignedCount}
                  </Badge>
                </p>
              </div>
            )}

            {/* Students per section input */}
            <FormField
              control={form.control}
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
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Live Preview */}
            {preview.length > 0 && (
              <div className="bg-muted space-y-1 rounded-md p-3">
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                  Preview ({preview.length} sections)
                </p>
                {preview.map((section) => (
                  <div
                    key={section.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-mono font-medium">
                      Section {section.name}
                    </span>
                    <Badge variant="outline">{section.count} students</Badge>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={
                  generateMutation.isPending ||
                  unassignedCount === 0 ||
                  !selectedSemesterId
                }
              >
                {generateMutation.isPending
                  ? "Generating..."
                  : `Generate ${preview.length} Sections`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
