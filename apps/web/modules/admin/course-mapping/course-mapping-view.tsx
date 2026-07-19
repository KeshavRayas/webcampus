"use client";

import { useDepartments } from "@/lib/use-departments";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { Button } from "@webcampus/ui/components/button";
import axios from "axios";
import { Download, Lock, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CourseDetailsCard } from "../../department/course-mapping/course-details-card";
import {
  AdminCourseMappingFilters,
  AdminCourseMappingFiltersState,
} from "./course-mapping-filters";
import { AdminCourseMappingGrid } from "./course-mapping-grid";

export const AdminCourseMappingView = () => {
  const { data: departments = [] } = useDepartments();
  const [appliedFilters, setAppliedFilters] =
    useState<AdminCourseMappingFiltersState | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CourseResponseDTO | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const handleDownloadTemplate = async () => {
    if (!selectedCourse || !appliedFilters) return;
    try {
      setIsProcessingExcel(true);
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/excel/template`,
        {
          params: {
            courseId: selectedCourse.id,
            semesterId: appliedFilters.semesterId,
            departmentId: appliedFilters.departmentId,
          },
          responseType: "blob",
          withCredentials: true,
        }
      );

      // create a blob link to download

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${selectedCourse.code}_mapping_template.xlsx`
      );
      document.body.appendChild(link);

      link.click();
      link.remove();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Failed to download template");
    } finally {
      setIsProcessingExcel(false);
    }
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCourse || !appliedFilters) return;

    try {
      setIsProcessingExcel(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("courseId", selectedCourse.id);
      formData.append("semesterId", appliedFilters.semesterId);
      formData.append("departmentId", appliedFilters.departmentId);
      formData.append("academicYear", appliedFilters.academicYear);

      await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/excel/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );

      toast.success("Excel mapping uploaded successfully");

      // Can optionally trigger a re-fetch of course assignments here
    } catch (error: unknown) {
      console.error(error);
      toast.error("Failed to upload Excel mapping");
    } finally {
      setIsProcessingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectedDepartment = useMemo(
    () =>
      departments.find(
        (department) => department.id === appliedFilters?.departmentId
      ),
    [appliedFilters?.departmentId, departments]
  );

  const isBasicSciences = selectedDepartment?.type === "BASIC_SCIENCES";
  const isCourseLocked =
    selectedCourse?.approvalStatus === "PENDING" ||
    selectedCourse?.approvalStatus === "APPROVED";

  return (
    <div className="space-y-8">
      {isCourseLocked && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-4">
          <Lock className="mt-0.5 h-5 w-5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-medium leading-none tracking-tight">
              Course Locked
            </h5>
            <div className="text-sm">
              This course is part of a semester that is locked for
              review/approval. Mappings cannot be altered.
            </div>
          </div>
        </div>
      )}

      <AdminCourseMappingFilters
        onCourseSelect={setSelectedCourse}
        onAppliedFiltersChange={setAppliedFilters}
      />

      {selectedCourse &&
        selectedDepartment &&
        appliedFilters?.semesterId &&
        appliedFilters?.academicYear && (
          <div className="flex w-full flex-col gap-6">
            <CourseDetailsCard course={selectedCourse} />

            <div className="bg-card text-card-foreground w-full overflow-hidden rounded-xl border shadow-sm">
              <div className="p-6">
                {/* --- Excel Action Buttons --- */}
                <div className="mb-4 flex flex-row items-center justify-between">
                  <h3 className="text-lg font-semibold">Faculty Assignments</h3>

                  {!isCourseLocked && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleDownloadTemplate}
                        disabled={isProcessingExcel}
                      >
                        <Download className="mr-2 h-4 w-4" /> Download Template
                      </Button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx"
                        onChange={handleUploadExcel}
                      />

                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingExcel}
                      >
                        <Upload className="mr-2 h-4 w-4" /> Upload Excel
                      </Button>
                    </div>
                  )}
                </div>
                {/* --- End of Excel Action Buttons --- */}

                <AdminCourseMappingGrid
                  course={selectedCourse}
                  departmentId={selectedDepartment.id}
                  departmentName={selectedDepartment.name}
                  semesterId={appliedFilters.semesterId}
                  academicYear={appliedFilters.academicYear}
                  cycle={appliedFilters.cycle}
                  isBasicSciences={isBasicSciences}
                  isLocked={isCourseLocked}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
