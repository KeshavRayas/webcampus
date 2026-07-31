"use client";

import { authClient } from "@/lib/auth-client";
import { AdminCondonationReportView } from "@/modules/admin/academics/reports/admin-condonation-report-view";
import { Loader2 } from "lucide-react";

export const HodCondonationReportView = () => {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as unknown as {
    faculty?: { departmentId?: string; department?: { name?: string } };
  };

  if (isPending) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  const departmentId = user?.faculty?.departmentId;
  const departmentName = user?.faculty?.department?.name;

  if (!departmentId || !departmentName) {
    return (
      <div className="text-muted-foreground flex h-[400px] items-center justify-center">
        HOD Department information not found.
      </div>
    );
  }

  return (
    <AdminCondonationReportView
      fixedDepartmentId={departmentId}
      fixedDepartmentName={departmentName}
    />
  );
};
