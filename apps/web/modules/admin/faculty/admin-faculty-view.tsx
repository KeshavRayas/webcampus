"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { DepartmentResponseDTO } from "@webcampus/schemas/department";
import { DesignationEnum, StaffTypeEnum } from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  FilterBuilder,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { PasswordInput } from "@webcampus/ui/components/password-input";
// import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import axios from "axios";
// import { X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { UserPhotoUpload } from "../shared/user-photo-upload";
import {
  AdminFacultyResponse,
  getAdminFacultyColumns,
} from "./admin-faculty-columns";
import { useCreateAdminFacultyForm } from "./use-create-admin-faculty-form";

// import { ALL } from "dns";

export const AdminFacultyView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const ALL_DEPARTMENTS_VALUE = "__all__";
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    ALL_DEPARTMENTS_VALUE
  );

  // 1. Fetch Departments for the global dropdown
  const { data: departments = [] } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<DepartmentResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/department`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data.filter((department) => {
          return department.type !== "BASIC_SCIENCES";
        });
      }
      return [] as DepartmentResponseDTO[];
    },
  });

  const departmentOptions = useMemo(() => {
    return departments
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((dept) => ({
        value: dept.id,
        label: dept.name,
      }));
  }, [departments]);

  // 2. Fetch Faculty ONLY for the selected department
  const { data: faculty = [], isLoading: facultyLoading } = useQuery({
    queryKey: ["admin-faculty", selectedDepartmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AdminFacultyResponse[]>>(
        selectedDepartmentId === ALL_DEPARTMENTS_VALUE
          ? `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty`
          : `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty/department/${selectedDepartmentId}`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data))
        return res.data.data;
      return [] as AdminFacultyResponse[];
    },
  });

  const designationOrder: Record<string, number> = {
    PROFESSOR: 2,
    ASSOCIATE_PROFESSOR: 3,
    ASSISTANT_PROFESSOR: 4,
    VISITING_PROFESSOR: 5,
  };

  const sortedFaculty = useMemo(() => {
    return [...faculty].sort((a, b) => {
      if (selectedDepartmentId === ALL_DEPARTMENTS_VALUE) {
        // If all departments are selected, sort by department name first
        const deptA = a.department?.name || "";
        const deptB = b.department?.name || "";
        const deptCompare = deptA.localeCompare(deptB);
        if (deptCompare !== 0) return deptCompare;
      }

      const AIsHod = !!a.hod;
      const BIsHod = !!b.hod;
      if (AIsHod && !BIsHod) return -1;
      if (!AIsHod && BIsHod) return 1;

      const aDesig = designationOrder[a.designation] || Number.MAX_SAFE_INTEGER;
      const bDesig = designationOrder[b.designation] || Number.MAX_SAFE_INTEGER;
      if (aDesig !== bDesig) return aDesig - bDesig;

      const nameA = a.user.name || "";
      const nameB = b.user.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [faculty, selectedDepartmentId]);

  const { form, onSubmit, imageFile, setImageFile, previewUrl } =
    useCreateAdminFacultyForm(selectedDepartmentId);

  const columns = useMemo(
    () => getAdminFacultyColumns(selectedDepartmentId, ALL_DEPARTMENTS_VALUE),
    [selectedDepartmentId]
  );

  return (
    <div className="space-y-8">
      {/* Global Department Selector */}
      <div className="w-full space-y-4">
        <FilterPanel>
          <FilterBuilder
            fields={[
              {
                key: "departmentId",
                label: "Select Department",
                type: "select",
                allOptionLabel: "All departments",
                placeholder: "Select a department...",
                options: departmentOptions,
              },
            ]}
            draftFilters={{ departmentId: selectedDepartmentId }}
            onDraftChange={(key, value) => {
              if (key === "departmentId") {
                setSelectedDepartmentId(value);
              }
            }}
            allValue={ALL_DEPARTMENTS_VALUE}
            className="md:grid-cols-1 xl:grid-cols-4"
          />
        </FilterPanel>
      </div>

      {/* Conditionally render table and create form if department is selected */}
      {selectedDepartmentId && (
        <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold tracking-tight">
              Department Faculty
            </h3>
            <DialogForm
              trigger={
                <Button
                  disabled={selectedDepartmentId === ALL_DEPARTMENTS_VALUE}
                >
                  {selectedDepartmentId === ALL_DEPARTMENTS_VALUE
                    ? "Select Department to Add"
                    : "Add Faculty"}
                </Button>
              }
              title="Create Faculty"
              form={form}
              onSubmit={onSubmit}
              contentClassName="sm:max-w-2xl"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* LEFT COLUMN */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Bruno Fernandes"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="bruno@university.edu"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="designation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select designation" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DesignationEnum.options.map((designation) => (
                              <SelectItem key={designation} value={designation}>
                                {designation
                                  .split("_")
                                  .map(
                                    (w) =>
                                      w.charAt(0) + w.slice(1).toLowerCase()
                                  )
                                  .join(" ")}
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
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={
                              field.value
                                ? new Date(field.value)
                                    .toISOString()
                                    .slice(0, 10)
                                : ""
                            }
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., bruno.f" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="Password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., EMP2357433" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="staffType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select staff type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {StaffTypeEnum.options.map((staffType) => (
                              <SelectItem key={staffType} value={staffType}>
                                {staffType
                                  .split("_")
                                  .map(
                                    (w) =>
                                      w.charAt(0) + w.slice(1).toLowerCase()
                                  )
                                  .join(" ")}
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
                    name="dateOfJoining"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Joining *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={
                              field.value
                                ? new Date(field.value)
                                    .toISOString()
                                    .slice(0, 10)
                                : ""
                            }
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* FULL WIDTH - FACULTY IMAGE */}
              {/* <FormItem>
                <FormLabel>Faculty Image *</FormLabel>
                <FormControl>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setImageFile(file);
                        }}
                      />
                      {previewUrl && (
                        <div className="border-border group relative mt-2 h-24 w-24 rounded-md border">
                          <img
                            src={previewUrl}
                            alt="Faculty preview"
                            className="h-full w-full rounded-md object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-100 shadow-sm hover:opacity-90"
                            onClick={() => setImageFile(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem> */}
              <UserPhotoUpload
                label="Faculty Image *"
                personName={form.watch("name") || "Faculty"}
                previewUrl={previewUrl}
                selectedFileName={imageFile?.name || null}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setImageFile(file);
                }}
              />
            </DialogForm>
          </div>

          {facultyLoading ? (
            <div>Loading faculty...</div>
          ) : (
            <DataTable columns={columns} data={sortedFaculty} />
          )}
        </div>
      )}
    </div>
  );
};
