"use client";
import { z } from "zod";
import { CreateCourseDTO } from "@webcampus/schemas/department";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { Combobox } from "@webcampus/ui/molecules/combobox";
import React, { useEffect, useRef } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { CreateCourseSchema } from "@webcampus/schemas/department";

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
  { [K in keyof CreateCourseDTO]: CreateCourseDTO[K] extends number ? K : never }[keyof CreateCourseDTO],
  undefined
>;

// Simplified mode rules for the new schema - adjust preset defaults as needed
const MODE_RULES: Partial<Record<CreateCourseDTO["courseMode"], any>> = {
  INTEGRATED: { preset: { tutorialCredits: 0, skillCredits: 0 }, helperText: "Integrated Course Configuration." },
  NON_INTEGRATED: { preset: { tutorialCredits: 0, practicalCredits: 0, skillCredits: 0, labCount: 0, labMaxMarks: 0 }, helperText: "Non-Integrated Course Configuration." },
  FINAL_SUMMARY: { preset: { tutorialCredits: 0, practicalCredits: 0, skillCredits: 0, labCount: 0, labMaxMarks: 0, aatMaxMarks: 0, theoryMaxMarks: 0 }, helperText: "Final Summary Mode." },
  NCMC: { preset: { tutorialCredits: 0, practicalCredits: 0, skillCredits: 0, seeMaxMarks: 0, cieMaxMarks: 0, theoryMaxMarks: 0, labMaxMarks: 0, aatMaxMarks: 0 }, helperText: "Non-Credit Mandatory Course." },
};

const NumberField = ({ form, name, label, disabled = false, placeholder = "0" }: { form: UseFormReturn<CreateCourseDTO>; name: keyof CreateCourseDTO; label: string; disabled?: boolean; placeholder?: string }) => (
  <FormField control={form.control} name={name} render={({ field }) => (
    <FormItem>
      <FormLabel className="text-xs">{label}</FormLabel>
      <FormControl>
        <Input type="number" min="0" placeholder={placeholder} disabled={disabled} className={disabled ? "bg-muted text-muted-foreground" : undefined} {...field} value={field.value as number} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )} />
);

const CheckboxField = ({ form, name, label }: { form: UseFormReturn<CreateCourseDTO>; name: keyof CreateCourseDTO; label: string }) => (
  <FormField control={form.control} name={name} render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
      <FormControl>
        <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>{label}</FormLabel>
      </div>
    </FormItem>
  )} />
);

const FormSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="rounded-md border p-3 pt-1">
    <legend className="text-muted-foreground px-1 text-xs font-medium">{title}</legend>
    {children}
  </fieldset>
);

export const CourseFormFields = ({ form }: { form: UseFormReturn<z.infer<typeof CreateCourseSchema>> }) => {
  const courseMode = useWatch({ control: form.control, name: "courseMode" });
  const isModeInitialMount = useRef(true);

  useEffect(() => {
    if (isModeInitialMount.current) {
      isModeInitialMount.current = false;
      return;
    }
    if (!courseMode) return;

    const modeRule = MODE_RULES[courseMode as keyof typeof MODE_RULES];
    if (!modeRule) return;

    Object.entries(modeRule.preset).forEach(([field, value]) => {
      form.setValue(field as NumericCourseField, value as number ?? 0, { shouldDirty: true, shouldValidate: true });
    });
  }, [courseMode, form]);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {/* Basic Info Fields (Code, Name, Mode, Type) remain same */}
        <FormField control={form.control} name="code" render={({ field }) => (
          <FormItem><FormLabel>Course Code *</FormLabel><FormControl><Input placeholder="e.g., CS101" {...field} className="uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Course Name *</FormLabel><FormControl><Input placeholder="Course Name" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="courseMode" render={({ field }) => (
          <FormItem><FormLabel>Course Mode *</FormLabel><FormControl><Combobox options={COURSE_MODE_OPTIONS as any} value={field.value} onValueChange={field.onChange} placeholder="Select mode" className="w-full" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="courseType" render={({ field }) => (
          <FormItem><FormLabel>Course Type *</FormLabel><FormControl><Combobox options={COURSE_TYPE_OPTIONS as any} value={field.value} onValueChange={field.onChange} placeholder="Select type" className="w-full" /></FormControl><FormMessage /></FormItem>
        )} />
      </div>

      <FormSection title="Credits (L-T-P-S)">
        <div className="grid grid-cols-4 gap-3">
          <NumberField form={form} name="lectureCredits" label="Lecture (L)" />
          <NumberField form={form} name="tutorialCredits" label="Tutorial (T)" />
          <NumberField form={form} name="practicalCredits" label="Practical (P)" />
          <NumberField form={form} name="skillCredits" label="Skill (S)" />
        </div>
      </FormSection>

      <FormSection title="Assessment Configuration">
        <div className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">SEE</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberField form={form} name="seeMaxMarks" label="Max Marks" />
                <NumberField form={form} name="seeEligibility" label="Eligibility (%)" placeholder="40" />
              </div>
            </div>
            
            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">CIE</p>
              <div className="grid grid-cols-3 gap-3">
                <NumberField form={form} name="cieCount" label="No. of CIEs" />
                <NumberField form={form} name="cieMaxMarks" label="Max Marks" />
                <NumberField form={form} name="cieEligibility" label="Eligibility (%)" placeholder="40" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">Theory Exam</p>
              <div className="grid grid-cols-3 gap-3">
                <NumberField form={form} name="theoryMaxMarks" label="Max Marks" />
                <NumberField form={form} name="theoryMinExams" label="Min Required" />
                <NumberField form={form} name="theoryEligibility" label="Eligibility (%)" placeholder="40" />
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">Lab</p>
              <div className="grid grid-cols-3 gap-3">
                <NumberField form={form} name="labCount" label="No. of Labs" />
                <NumberField form={form} name="labMaxMarks" label="Max Marks" />
                <NumberField form={form} name="labEligibility" label="Eligibility (%)" placeholder="40" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">AAT</p>
            <div className="grid grid-cols-2 gap-3 max-w-[50%] pr-2">
              <NumberField form={form} name="aatMaxMarks" label="Max Marks" />
              <NumberField form={form} name="aatEligibility" label="Eligibility (%)" placeholder="40" />
            </div>
          </div>

        </div>
      </FormSection>

      <FormSection title="Additional Settings">
        <div className="grid grid-cols-2 gap-4">
          <CheckboxField form={form} name="allowFeedback" label="Allow Feedback" />
          <CheckboxField form={form} name="attendanceRequired" label="Attendance Required" />
        </div>
      </FormSection>
    </>
  );
};