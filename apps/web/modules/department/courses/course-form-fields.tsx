"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateCourseDTO,
  CreateCourseSchema,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Combobox, ComboboxOption } from "@webcampus/ui/molecules/combobox";
import { MultiCombobox } from "@webcampus/ui/molecules/multi-combobox";
import axios from "axios";
import React, { useEffect, useRef } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { z } from "zod";

const COURSE_MODE_OPTIONS: ComboboxOption[] = [
  { value: "INTEGRATED", label: "Integrated" },
  { value: "NON_INTEGRATED", label: "Non-Integrated" },
  { value: "FINAL_SUMMARY", label: "Final Summary" },
  { value: "NCMC", label: "NCMC" },
];

const COURSE_TYPE_OPTIONS: ComboboxOption[] = [
  { value: "PC", label: "Professional Core (PC)" },
  { value: "PE", label: "Professional Elective (PE)" },
  { value: "OE", label: "Open Elective (OE)" },
  { value: "NCMC", label: "Non-Credit Mandatory (NCMC)" },
];

const OPEN_ELECTIVE_ELIGIBILITY_OPTIONS: ComboboxOption[] = [
  { value: "ALL", label: "All departments" },
  { value: "ALL_EXCEPT_OWNER", label: "All except my department" },
  { value: "CUSTOM", label: "Custom selection" },
];

type NumericCourseField = Exclude<
  {
    [K in keyof CreateCourseDTO]: CreateCourseDTO[K] extends number ? K : never;
  }[keyof CreateCourseDTO],
  undefined
>;

type ModeRule = {
  preset: Partial<Record<NumericCourseField, number>>;
  helperText: string;
};

const MODE_RULES: Partial<Record<CreateCourseDTO["courseMode"], ModeRule>> = {
  INTEGRATED: {
    preset: { tutorialCredits: 0, skillCredits: 0 },
    helperText: "Integrated Course Configuration.",
  },
  NON_INTEGRATED: {
    preset: {
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,
      labMaxMarks: 0,
      labEligibility: 0,
    },
    helperText: "Non-Integrated Course Configuration.",
  },
  FINAL_SUMMARY: {
    preset: {
      labMaxMarks: 0,
      labEligibility: 0,
      aatMaxMarks: 0,
      aatEligibility: 0,
    },
    helperText: "Final Summary Mode.",
  },
  NCMC: {
    preset: {
      lectureCredits: 0,
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,
      seeMaxMarks: 0,
      seeEligibility: 0,
      labMaxMarks: 0,
      labEligibility: 0,
      aatMaxMarks: 0,
      aatEligibility: 0,
    },
    helperText: "Non-Credit Mandatory Course.",
  },
};

const NumberField = ({
  form,
  name,
  label,
  disabled = false,
  placeholder = "0",
}: {
  form: UseFormReturn<CreateCourseDTO>;
  name: keyof CreateCourseDTO;
  label: string;
  disabled?: boolean;
  placeholder?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel className="text-xs">{label}</FormLabel>
        <FormControl>
          <Input
            type="number"
            min="0"
            placeholder={placeholder}
            disabled={disabled}
            className={disabled ? "bg-muted text-muted-foreground" : undefined}
            {...field}
            value={(field.value as number) ?? ""}
            onChange={(e) =>
              field.onChange(
                e.target.value === ""
                  ? undefined
                  : parseInt(e.target.value) || 0
              )
            }
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const CheckboxField = ({
  form,
  name,
  label,
}: {
  form: UseFormReturn<CreateCourseDTO>;
  name: keyof CreateCourseDTO;
  label: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
        <FormControl>
          <Checkbox
            checked={field.value as boolean}
            onCheckedChange={field.onChange}
          />
        </FormControl>
        <div className="space-y-1 leading-none">
          <FormLabel>{label}</FormLabel>
        </div>
      </FormItem>
    )}
  />
);

const FormSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <fieldset className="rounded-md border p-3 pt-1">
    <legend className="text-muted-foreground px-1 text-xs font-medium">
      {title}
    </legend>
    {children}
  </fieldset>
);

export const CourseFormFields = ({
  form,
  existingElectiveBatches,
  apiPath = "department",
}: {
  form: UseFormReturn<z.infer<typeof CreateCourseSchema>>;
  existingElectiveBatches?: {
    id: string;
    name: string;
    studentCount: number;
  }[];
  apiPath?: "department" | "admin";
}) => {
  const courseMode = useWatch({ control: form.control, name: "courseMode" });
  const courseType = useWatch({ control: form.control, name: "courseType" });
  const numberOfBatches = useWatch({
    control: form.control,
    name: "numberOfBatches",
  });
  const semesterId = useWatch({ control: form.control, name: "semesterId" });
  const cycle = useWatch({ control: form.control, name: "cycle" });
  const departmentId = useWatch({
    control: form.control,
    name: "departmentId",
  });
  const isPe = courseType === "PE";
  const isOe = courseType === "OE";
  const openElectiveEligibility = useWatch({
    control: form.control,
    name: "openElectiveEligibility",
  });

  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: departments = [] } = useQuery({
    queryKey: ["course-form-departments", apiPath],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{ id: string; name: string; code: string }[]>
      >(
        `${NEXT_PUBLIC_API_BASE_URL}/${
          apiPath === "admin"
            ? "admin/department"
            : "department/course/departments"
        }`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data ?? [];
      return [];
    },
    enabled: isOe && openElectiveEligibility === "CUSTOM",
  });
  const { data: capacitySummary } = useQuery({
    queryKey: [
      "pe-capacity-summary",
      apiPath,
      semesterId,
      cycle || "NONE",
      departmentId ?? "",
    ],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{
          eligibleStudents: number;
          configuredCapacity: number;
          remainingSeats: number;
        }>
      >(`${NEXT_PUBLIC_API_BASE_URL}/${apiPath}/course/pe-capacity-summary`, {
        params: {
          semesterId,
          ...(cycle && cycle !== "NONE" ? { cycle } : {}),
          ...(apiPath === "admin" && departmentId ? { departmentId } : {}),
        },
        withCredentials: true,
      });
      if (res.data.status === "success") return res.data.data;
      return null;
    },
    enabled: isPe && !!semesterId,
  });
  const isModeInitialMount = useRef(true);
  const existingBatchCount = existingElectiveBatches?.length ?? 0;
  const isDecreasingBatches =
    isPe &&
    existingBatchCount > 0 &&
    typeof numberOfBatches === "number" &&
    numberOfBatches < existingBatchCount;
  const requiredRemovals = isDecreasingBatches
    ? existingBatchCount - (numberOfBatches as number)
    : 0;

  useEffect(() => {
    if (!isDecreasingBatches) {
      if (form.getValues("electiveBatchesToRemove")?.length) {
        form.setValue("electiveBatchesToRemove", undefined);
      }
    }
  }, [isDecreasingBatches, form]);

  useEffect(() => {
    if (isModeInitialMount.current) {
      isModeInitialMount.current = false;
      return;
    }
    if (!courseMode) return;

    const modeRule = MODE_RULES[courseMode as keyof typeof MODE_RULES];
    if (!modeRule) return;

    Object.entries(modeRule.preset).forEach(([field, value]) => {
      form.setValue(field as NumericCourseField, value ?? 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  }, [courseMode, form]);

  const modeRule = MODE_RULES[courseMode as keyof typeof MODE_RULES];
  const isLocked = (field: NumericCourseField) =>
    modeRule?.preset[field] !== undefined;
  const modeOptions =
    isPe || isOe
      ? COURSE_MODE_OPTIONS.filter((o) => o.value === "NON_INTEGRATED")
      : COURSE_MODE_OPTIONS;

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {/* Basic Info Fields (Code, Name, Mode, Type) remain same */}
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Code *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., CS101"
                  {...field}
                  className="uppercase"
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Name *</FormLabel>
              <FormControl>
                <Input placeholder="Course Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="courseMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Mode *</FormLabel>
              <FormControl>
                <Combobox
                  options={modeOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select mode"
                  className="w-full"
                  disabled={isPe || isOe}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="courseType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Type *</FormLabel>
              <FormControl>
                <Combobox
                  options={COURSE_TYPE_OPTIONS}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === "PE" || value === "OE") {
                      form.setValue("courseMode", "NON_INTEGRATED", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  placeholder="Select type"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {modeRule && (
        <p
          className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-xs"
          role="status"
        >
          {modeRule.helperText} Fields disabled for this mode are fixed at 0.
        </p>
      )}

      <FormSection title="Credits (L-T-P-S)">
        <div className="grid grid-cols-4 gap-3">
          <NumberField
            form={form}
            name="lectureCredits"
            label="Lecture (L)"
            disabled={isLocked("lectureCredits")}
          />
          <NumberField
            form={form}
            name="tutorialCredits"
            label="Tutorial (T)"
            disabled={isLocked("tutorialCredits")}
          />
          <NumberField
            form={form}
            name="practicalCredits"
            label="Practical (P)"
            disabled={isLocked("practicalCredits")}
          />
          <NumberField
            form={form}
            name="skillCredits"
            label="Skill (S)"
            disabled={isLocked("skillCredits")}
          />
        </div>
      </FormSection>

      <FormSection title="Assessment Configuration">
        <div className="space-y-4">
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
              SEE
            </p>
            <div className="grid max-w-[50%] grid-cols-2 gap-3 pr-2">
              <NumberField
                form={form}
                name="seeMaxMarks"
                label="Max Marks"
                disabled={isLocked("seeMaxMarks")}
              />
              <NumberField
                form={form}
                name="seeEligibility"
                label="Eligibility (%)"
                placeholder="40"
                disabled={isLocked("seeEligibility")}
              />
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
              CIE
            </p>
            <div className="grid max-w-[50%] grid-cols-2 gap-3 pr-2">
              <NumberField
                form={form}
                name="cieMaxMarks"
                label="CIE Max Marks"
                disabled={isLocked("cieMaxMarks")}
              />
              <NumberField
                form={form}
                name="cieEligibility"
                label="Eligibility (%)"
                placeholder="40"
                disabled={isLocked("cieEligibility")}
              />
            </div>

            <div className="border-muted mt-3 space-y-3 border-l-2 pl-3">
              <FormSection title="Theory Exam">
                <div className="grid grid-cols-3 gap-3">
                  <NumberField
                    form={form}
                    name="theoryMaxExams"
                    label="No. of Exams"
                    disabled={isLocked("theoryMaxExams")}
                  />
                  <NumberField
                    form={form}
                    name="theoryExamMaxMarks"
                    label="Max Marks"
                    disabled={isLocked("theoryExamMaxMarks")}
                  />
                  <NumberField
                    form={form}
                    name="theoryMinExams"
                    label="Min. Exams Required"
                    disabled={isLocked("theoryMinExams")}
                  />
                  <NumberField
                    form={form}
                    name="theoryEligibility"
                    label="Eligibility (%)"
                    placeholder="40"
                    disabled={isLocked("theoryEligibility")}
                  />
                  <NumberField
                    form={form}
                    name="theoryCieContribution"
                    label="Theory Contribution to CIE"
                    disabled={isLocked("theoryCieContribution")}
                  />
                </div>
              </FormSection>

              <FormSection title="Lab">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    form={form}
                    name="labMaxMarks"
                    label="Max Marks"
                    disabled={isLocked("labMaxMarks")}
                  />
                  <NumberField
                    form={form}
                    name="labEligibility"
                    label="Eligibility (%)"
                    placeholder="40"
                    disabled={isLocked("labEligibility")}
                  />
                </div>
              </FormSection>

              <FormSection title="AAT">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    form={form}
                    name="aatMaxMarks"
                    label="Max Marks"
                    disabled={isLocked("aatMaxMarks")}
                  />
                  <NumberField
                    form={form}
                    name="aatEligibility"
                    label="Eligibility (%)"
                    placeholder="40"
                    disabled={isLocked("aatEligibility")}
                  />
                </div>
              </FormSection>
            </div>
          </div>
        </div>
      </FormSection>

      {isPe && (
        <FormSection title="Elective Batches">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              form={form}
              name="numberOfBatches"
              label="Number of Batches *"
              placeholder="1"
            />
            <NumberField
              form={form}
              name="studentsPerBatch"
              label="Students Per Batch *"
              placeholder="30"
            />
          </div>
          {isDecreasingBatches && (
            <FormField
              control={form.control}
              name="electiveBatchesToRemove"
              rules={{
                validate: (value?: string[]) => {
                  const selected = value ?? [];
                  if (selected.length !== requiredRemovals) {
                    return `Select exactly ${requiredRemovals} batch${
                      requiredRemovals === 1 ? "" : "es"
                    } to remove.`;
                  }
                  return true;
                },
              }}
              render={({ field }) => (
                <FormItem className="mt-3">
                  <FormLabel className="text-xs">
                    Select {requiredRemovals} batch
                    {requiredRemovals === 1 ? "" : "es"} to remove
                  </FormLabel>
                  <div className="space-y-1.5">
                    {existingElectiveBatches?.map((b) => {
                      const checked = (field.value ?? []).includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="text-foreground flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(state) => {
                              const current = field.value ?? [];
                              const next = state
                                ? [...current, b.id]
                                : current.filter((id) => id !== b.id);
                              field.onChange(next);
                            }}
                          />
                          <span>{b.name}</span>
                          <span className="text-muted-foreground">
                            ({b.studentCount ?? 0} student
                            {(b.studentCount ?? 0) === 1 ? "" : "s"})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <p className="text-muted-foreground mt-2 text-xs">
            Capacity = Number of Batches × Students Per Batch. Batch names
            default to &quot;{"{code}"} 1&quot;, &quot;{"{code}"} 2&quot;, …
          </p>
          {capacitySummary && (
            <div className="bg-muted/50 mt-2 space-y-0.5 rounded-md px-3 py-2 text-xs">
              <p className="text-muted-foreground">
                Eligible students: {capacitySummary.eligibleStudents}
              </p>
              <p className="text-muted-foreground">
                Configured capacity: {capacitySummary.configuredCapacity}
              </p>
              {capacitySummary.remainingSeats < 0 ? (
                <p className="text-destructive font-medium">
                  Remaining seats required:{" "}
                  {Math.abs(capacitySummary.remainingSeats)}
                </p>
              ) : capacitySummary.remainingSeats === 0 ? (
                <p className="font-medium text-green-600">
                  Capacity requirement satisfied.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Excess capacity: {capacitySummary.remainingSeats} seats.
                </p>
              )}
            </div>
          )}
        </FormSection>
      )}

      {isOe && (
        <FormSection title="Eligible Departments">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              form={form}
              name="numberOfBatches"
              label="Number of Batches *"
              placeholder="1"
            />
            <NumberField
              form={form}
              name="studentsPerBatch"
              label="Students Per Batch *"
              placeholder="30"
            />
          </div>

          <FormField
            control={form.control}
            name="openElectiveEligibility"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who can register? *</FormLabel>
                <FormControl>
                  <Combobox
                    options={OPEN_ELECTIVE_ELIGIBILITY_OPTIONS}
                    value={field.value ?? "ALL"}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "CUSTOM") {
                        form.setValue("eligibleDepartmentIds", []);
                      }
                    }}
                    placeholder="Select eligibility"
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {openElectiveEligibility === "CUSTOM" && (
            <FormField
              control={form.control}
              name="eligibleDepartmentIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eligible Departments *</FormLabel>
                  <FormControl>
                    <MultiCombobox
                      options={departments.map((dept) => ({
                        value: dept.id,
                        label: dept.name,
                        sublabel: dept.code,
                      }))}
                      value={field.value ?? []}
                      onValueChange={field.onChange}
                      placeholder="Select departments"
                      searchPlaceholder="Search departments..."
                      emptyMessage="No departments found."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <p className="text-muted-foreground mt-2 text-xs">
            Controls which departments can register for this Open Elective.
            "Custom" lets you pick specific departments. Students pick their own
            batch at registration time (first-come, first-served).
          </p>
        </FormSection>
      )}

      <FormSection title="Additional Settings">
        <div className="grid grid-cols-2 gap-4">
          <CheckboxField
            form={form}
            name="allowFeedback"
            label="Allow Feedback"
          />
          <CheckboxField
            form={form}
            name="attendanceRequired"
            label="Attendance Required"
          />
        </div>
      </FormSection>
    </>
  );
};
