"use client";

import { CourseResponseDTO } from "@webcampus/schemas/department";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { DataTable } from "@webcampus/ui/components/data-table";
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
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import React from "react";
import { DepartmentCoursesColumns } from "./department-courses-columns";
import { useCreateCourseForm } from "./use-create-course-form";

const COURSE_TYPES = [
  { value: "core", label: "Core" },
  { value: "elective", label: "Elective" },
  { value: "lab", label: "Laboratory" },
  { value: "seminar", label: "Seminar" },
  { value: "project", label: "Project" },
] as const;

interface SemesterCourseBlockProps {
  semesterId: string;
  semesterNumber: number;
  courses: CourseResponseDTO[];
}

export const SemesterCourseBlock = ({
  semesterId,
  semesterNumber,
  courses,
}: SemesterCourseBlockProps) => {
  // Initialize the form hook with the locked ID and Number
  const { form, onSubmit } = useCreateCourseForm(semesterId, semesterNumber);

  return (
    <div className="bg-card text-card-foreground mb-12 space-y-4 rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-tight">
          Semester {semesterNumber}
        </h3>
        <DialogForm
          trigger={`Add Course to Sem ${semesterNumber}`}
          title={`Create Course (Semester ${semesterNumber})`}
          form={form}
          onSubmit={onSubmit}
        >
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
                    onChange={(e) =>
                      field.onChange(e.target.value.toUpperCase())
                    }
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select course type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COURSE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name="credits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credits *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      placeholder="e.g., 3"
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
          </div>

          <FormField
            control={form.control}
            name="hasLab"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Has Laboratory Component</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </DialogForm>
      </div>
      <DataTable columns={DepartmentCoursesColumns} data={courses} />
    </div>
  );
};
