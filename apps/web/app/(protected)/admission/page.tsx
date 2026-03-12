import { AdminAdmissionView } from "@/modules/admission/admin/admin-admission-view";
import React, { Suspense } from "react";

export default function AdminAdmissionPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admissions Portal</h1>
        <p className="text-muted-foreground text-sm">
          Create student admission shells and track application status.
        </p>
      </div>
      <Suspense>
        <AdminAdmissionView />
      </Suspense>
    </div>
  );
}
