"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { AdmissionResponse } from "../admin/admin-admission-columns";
import { getLeaveCollegeColumns } from "./leave-college-columns";

export function LeaveCollegeView() {
  const { data: admissions, isLoading } = useQuery({
    queryKey: ["leave-college-admissions"],
    queryFn: async () => {
      const res =
        await apiClient.get<BaseResponse<AdmissionResponse[]>>("/admission");

      if (res.data.status === "success") {
        return res.data.data ?? [];
      }

      return [];
    },
  });

  const [filter, setFilter] = useState<"all" | "active" | "left">("active");

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }
  const students = (admissions ?? []).filter((a) => a.primaryEmail);

  const filteredStudents = students.filter((student) => {
    switch (filter) {
      case "active":
        return student.status !== "EXITED";

      case "left":
        return student.status === "EXITED";

      default:
        return true;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave College</h1>

        <p className="text-muted-foreground">Mark students as exited.</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("active")}
          className={`rounded-md border px-3 py-2 ${
            filter === "active" ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          Active
        </button>

        <button
          onClick={() => setFilter("left")}
          className={`rounded-md border px-3 py-2 ${
            filter === "left" ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          Left College
        </button>

        <button
          onClick={() => setFilter("all")}
          className={`rounded-md border px-3 py-2 ${
            filter === "all" ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          All
        </button>
      </div>
      <DataTable columns={getLeaveCollegeColumns()} data={filteredStudents} />
    </div>
  );
}
