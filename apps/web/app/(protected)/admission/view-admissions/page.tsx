import { AdmissionView } from "@/modules/admission/admin/admission-view";
import React, { Suspense } from "react";

export default function ViewAdmissionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Admissions Management
        </h1>
        <p className="text-muted-foreground text-sm">
          Filter admissions by application ID, status, admission type, mode,
          date range, and semester.
        </p>
      </div>
      <Suspense>
        <AdmissionView hideAddForm showFilters />
      </Suspense>
    </div>
  );
}
