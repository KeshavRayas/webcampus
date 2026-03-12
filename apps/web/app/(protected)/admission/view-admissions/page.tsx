import { AdminAdmissionView } from "@/modules/admission/admin/admin-admission-view";
import React, { Suspense } from "react";

export default function ViewAdmissionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Admissions Management
        </h1>
        <p className="text-muted-foreground text-sm">
          Filter admissions by application ID, status, mode, date range, and
          semester.
        </p>
      </div>
      <Suspense>
        <AdminAdmissionView hideAddForm showFilters />
      </Suspense>
    </div>
  );
}
