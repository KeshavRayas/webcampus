"use client";

import { CreateCourseDTO } from "@webcampus/schemas/department";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Combobox } from "@webcampus/ui/molecules/combobox";
import React, { useEffect, useRef } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";

const COURSE_MODE_OPTIONS = [
  { value: "INTEGRATED", label: "Integrated" },
  { value: "NON_INTEGRATED", label: "Non-Integrated" },
  { value: "FINAL_SUMMARY", label: "Final Summary" },
  { value: "NCMC", label: "NCMC" },
] as const;

const COURSE_TYPE_OPTIONS = [
  { value: "PC", label: "Professional Core (PC)" },
  { value: "PE", label: "Professional Elective (PE)" },
  { value: "OE", label: "Open Elective (OE)" },
  { value: "NCMC", label: "Non-Credit Mandatory (NCMC)" },
] as const;

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
    preset: {
      tutorialCredits: 0,
      skillCredits: 0,
      noOfAssignments: 1,
      seeMaxMarks: 100,
      seeMinMarks: 35,
      seeWeightage: 50,
      maxNoOfCies: 3,
      minNoOfCies: 2,
      cieMaxMarks: 40,
      cieMinMarks: 0,
      cieWeightage: 50,
      assignmentMaxMarks: 5,
      labMaxMarks: 25,
      labMinMarks: 10,
      labWeightage: 0,
      cumulativeMaxMarks: 100,
      cumulativeMinMarks: 40,
    },
    helperText:
      "Integrated: Internal 50 (CIE 40×50% avg best 2/3 = 20 + AAT 5 + Lab 25) + SEE 50 (100×50% weightage, min 35). Pass if cumulative ≥ 40.",
  },
  NON_INTEGRATED: {
    preset: {
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,
      noOfAssignments: 1,
      seeMaxMarks: 100,
      seeMinMarks: 35,
      seeWeightage: 50,
      maxNoOfCies: 3,
      minNoOfCies: 2,
      cieMaxMarks: 40,
      cieMinMarks: 0,
      cieWeightage: 100,
      assignmentMaxMarks: 10,
      labMaxMarks: 0,
      labMinMarks: 0,
      labWeightage: 0,
      cumulativeMaxMarks: 100,
      cumulativeMinMarks: 40,
    },
    helperText:
      "Non-Integrated: Internal 50 (CIE 40×100% avg best 2/3 = 40 + AAT 10) + SEE 50 (100×50% weightage, min 35). Pass if cumulative ≥ 40.",
  },
  FINAL_SUMMARY: {
    preset: {
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,
      seeMaxMarks: 100,
      seeMinMarks: 35,
      seeWeightage: 50,
      maxNoOfCies: 3,
      minNoOfCies: 2,
      cieMaxMarks: 50,
      cieMinMarks: 20,
      cieWeightage: 100,
      noOfAssignments: 0,
      assignmentMaxMarks: 0,
      labMaxMarks: 0,
      labMinMarks: 0,
      labWeightage: 0,
      cumulativeMaxMarks: 100,
      cumulativeMinMarks: 40,
    },
    helperText:
      "Final Summary: Internal 50 (CIE best 2/3 with max 50, min 20, 100% weightage) + SEE 50 (100×50% weightage, min 35). Pass if cumulative ≥ 40.",
  },
  NCMC: {
    preset: {
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,
      seeMaxMarks: 0,
      seeMinMarks: 0,
      seeWeightage: 0,
      maxNoOfCies: 0,
      minNoOfCies: 0,
      cieMaxMarks: 0,
      cieMinMarks: 0,
      cieWeightage: 0,
      noOfAssignments: 0,
      assignmentMaxMarks: 0,
      labMaxMarks: 0,
      labMinMarks: 0,
      labWeightage: 0,
      cumulativeMaxMarks: 100,
      cumulativeMinMarks: 40,
    },
    helperText:
      "NCMC: Marks are interpreted as PP when score is 40 or above, otherwise NP.",
  },
};

/** Reusable number input form field */
const NumberField = ({
  form,
  name,
  label,
  disabled = false,
}: {
  form: UseFormReturn<CreateCourseDTO>;
  name: keyof CreateCourseDTO;
  label: string;
  disabled?: boolean;
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
            placeholder="0"
            disabled={disabled}
            className={disabled ? "bg-muted text-muted-foreground" : undefined}
            {...field}
            value={field.value as number}
            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

/** Outlined section wrapper with a title */
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

interface CourseFormFieldsProps {
  form: UseFormReturn<CreateCourseDTO>;
}

/**
 * Shared form field layout for Create and Edit course forms.
 * Renders the 3-section grid: Basic Info, Credits (L-T-P-S), Assessment Rubric.
 */
export const CourseFormFields = ({ form }: CourseFormFieldsProps) => {
  const courseMode = useWatch({
    control: form.control,
    name: "courseMode",
  });

  const isModeInitialMount = useRef(true);
  const originalFormSnapshot = useRef<Partial<
    Record<NumericCourseField, number>
  > | null>(null);
  const originalCourseMode = useRef<string | null>(null);

  useEffect(() => {
    if (isModeInitialMount.current) {
      isModeInitialMount.current = false;
      if (courseMode) {
        originalCourseMode.current = courseMode;
        const snapshot: Partial<Record<NumericCourseField, number>> = {};
        const fields: NumericCourseField[] = [
          "lectureCredits",
          "tutorialCredits",
          "practicalCredits",
          "skillCredits",
          "seeMaxMarks",
          "seeMinMarks",
          "seeWeightage",
          "maxNoOfCies",
          "minNoOfCies",
          "cieMaxMarks",
          "cieMinMarks",
          "cieWeightage",
          "noOfAssignments",
          "assignmentMaxMarks",
          "labMaxMarks",
          "labMinMarks",
          "labWeightage",
          "cumulativeMaxMarks",
          "cumulativeMinMarks",
        ];
        fields.forEach((f) => {
          snapshot[f] = form.getValues(f);
        });
        originalFormSnapshot.current = snapshot;
      }
      return;
    }

    if (!courseMode) return;

    if (
      originalCourseMode.current &&
      courseMode === originalCourseMode.current &&
      originalFormSnapshot.current
    ) {
      Object.entries(originalFormSnapshot.current).forEach(([field, value]) => {
        form.setValue(field as NumericCourseField, value ?? 0, {
          shouldDirty: true,
          shouldValidate: true,
        });
      });
      return;
    }

    const modeRule = MODE_RULES[courseMode];
    if (!modeRule) return;

    Object.entries(modeRule.preset).forEach(([field, value]) => {
      form.setValue(field as NumericCourseField, value ?? 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  }, [courseMode, form]);

  const modeHelperText =
    courseMode && MODE_RULES[courseMode]
      ? MODE_RULES[courseMode].helperText
      : "Select a course mode to auto-fill rubric fields.";

  return (
    <>
      {/* ── Section 1: Basic Info ── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
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
                  options={COURSE_MODE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select mode"
                  className="w-full"
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
                  options={COURSE_TYPE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select type"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* ── Section 2: Credits (L-T-P-S) ── */}
      <FormSection title="Credits (L-T-P-S)">
        <div className="grid grid-cols-4 gap-3">
          <NumberField form={form} name="lectureCredits" label="Lecture (L)" />
          <NumberField
            form={form}
            name="tutorialCredits"
            label="Tutorial (T)"
          />
          <NumberField
            form={form}
            name="practicalCredits"
            label="Practical (P)"
          />
          <NumberField form={form} name="skillCredits" label="Skill (S)" />
        </div>
      </FormSection>

      {/* ── Section 3: Assessment Rubric ── */}
      <FormSection title="Assessment Rubric">
        <div className="space-y-3">
          {/* SEE row */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
              SEE (Semester End Exam)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <NumberField form={form} name="seeMaxMarks" label="Max Marks" />
              <NumberField form={form} name="seeMinMarks" label="Min Marks" />
              <NumberField form={form} name="seeWeightage" label="Weightage" />
            </div>
          </div>

          {/* CIE row */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
              CIE (Continuous Internal)
            </p>
            <div className="mb-3">
              <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
                CIE Counts
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumberField form={form} name="maxNoOfCies" label="Max CIEs" />
                <NumberField form={form} name="minNoOfCies" label="Min CIEs" />
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
                CIE Marks
              </p>
              <div className="grid grid-cols-3 gap-3">
                <NumberField form={form} name="cieMaxMarks" label="Max Marks" />
                <NumberField form={form} name="cieMinMarks" label="Min Marks" />
                <NumberField
                  form={form}
                  name="cieWeightage"
                  label="Weightage"
                />
              </div>
            </div>
          </div>

          {/* Lab section */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
              Lab
            </p>
            <div className="grid grid-cols-3 gap-3">
              <NumberField form={form} name="labMaxMarks" label="Max Marks" />
              <NumberField form={form} name="labMinMarks" label="Min Marks" />
              <NumberField form={form} name="labWeightage" label="Weightage" />
            </div>
          </div>

          {/* Theory Assignments section */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
              Theory Assignments
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                form={form}
                name="noOfAssignments"
                label="# Assign."
              />
              <NumberField
                form={form}
                name="assignmentMaxMarks"
                label="Max Marks"
              />
            </div>
          </div>

          {/* Cumulative row */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
              Cumulative (SEE + CIE)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                form={form}
                name="cumulativeMaxMarks"
                label="Max Marks"
              />
              <NumberField
                form={form}
                name="cumulativeMinMarks"
                label="Min Marks"
              />
            </div>
          </div>

          <p className="text-muted-foreground text-xs">{modeHelperText}</p>
        </div>
      </FormSection>
    </>
  );
};
