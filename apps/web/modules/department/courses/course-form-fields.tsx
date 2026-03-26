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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import React from "react";
import { UseFormReturn } from "react-hook-form";

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

/** Reusable number input form field */
const NumberField = ({
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
      <FormItem>
        <FormLabel className="text-xs">{label}</FormLabel>
        <FormControl>
          <Input
            type="number"
            min="0"
            placeholder="0"
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COURSE_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COURSE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
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
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              CIE (Continuous Internal)
            </p>
            <div className="grid grid-cols-5 gap-3">
              <NumberField form={form} name="maxNoOfCies" label="Max CIEs" />
              <NumberField form={form} name="minNoOfCies" label="Min CIEs" />
              <NumberField form={form} name="cieMaxMarks" label="Max Marks" />
              <NumberField form={form} name="cieMinMarks" label="Min Marks" />
              <NumberField form={form} name="cieWeightage" label="Weightage" />
            </div>
          </div>

          {/* Lab & Assignments row */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              Lab &amp; Assignments
            </p>
            <div className="grid grid-cols-5 gap-3">
              <NumberField form={form} name="labMaxMarks" label="Lab Max" />
              <NumberField form={form} name="labMinMarks" label="Lab Min" />
              <NumberField form={form} name="labWeightage" label="Lab Wt." />
              <NumberField
                form={form}
                name="noOfAssignments"
                label="# Assign."
              />
              <NumberField
                form={form}
                name="assignmentMaxMarks"
                label="Assign. Max"
              />
            </div>
          </div>

          {/* Cumulative row */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              Cumulative
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
        </div>
      </FormSection>
    </>
  );
};
