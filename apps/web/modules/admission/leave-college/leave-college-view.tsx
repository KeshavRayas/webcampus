"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Loader2 } from "lucide-react";
import type { AdmissionResponse } from "../admin/admin-admission-columns";
import { getLeaveCollegeColumns } from "./leave-college-columns";

export function LeaveCollegeView() {
  const { data: admissions, isLoading } = useQuery({
    queryKey: ["leave-college-admissions"],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
        "/admission",
        {
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data ?? [];
      }

      return [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }
  const students = (admissions ?? []).filter((a) => a.student?.usn);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave College</h1>

        <p className="text-muted-foreground">Mark students as exited.</p>
      </div>

      <DataTable columns={getLeaveCollegeColumns()} data={students} />
    </div>
  );
}
