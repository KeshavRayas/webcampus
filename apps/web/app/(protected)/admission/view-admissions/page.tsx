import { AdmissionView } from "@/modules/admission/admin/admission-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import React, { Suspense } from "react";

export default function ViewAdmissionsPage() {
  return (
    <AdmissionConsoleShell
      title="Admissions, moving in real time."
      description="View, review, and follow every application from one workspace."
    >
      <Suspense>
        <AdmissionView hideAddForm showFilters />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
