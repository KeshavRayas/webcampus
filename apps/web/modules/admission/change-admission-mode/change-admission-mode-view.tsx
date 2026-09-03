"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Loader2 } from "lucide-react";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { getChangeAdmissionModeColumns } from "./change-admission-mode-columns";

export function ChangeAdmissionModeView() {
  const { data, isLoading } = useQuery({
    queryKey: ["change-admission-mode"],

    queryFn: async () => {
      const res =
        await apiClient.get<BaseResponse<AdmissionResponse[]>>("/admission");

      if (res.data.status === "error") {
        throw new Error(res.data.message);
      }

      return res.data.data ?? [];
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Change Admission Mode</h1>

        <p className="text-muted-foreground">
          Update admission details for existing students.
        </p>
      </div>

      <DataTable
        columns={getChangeAdmissionModeColumns()}
        data={(data ?? []).filter(
          (admission) => admission.status === "APPROVED"
        )}
      />
    </div>
  );
}
