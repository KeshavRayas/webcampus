import { AdminAdmissionView } from "@/modules/admission/admin/admin-admission-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import React, { Suspense } from "react";

export default function ViewAdmissionsPage() {
  return (
    <AdmissionConsoleShell
      title="Admissions management."
      description="Filter admissions by application, status, type, mode, date range, and semester."
    >
      <Suspense>
        <AdminAdmissionView hideAddForm showFilters />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
