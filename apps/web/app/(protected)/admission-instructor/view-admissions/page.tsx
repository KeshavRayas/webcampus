import { AdminAdmissionView } from "@/modules/admission/admin/admin-admission-view";
import React, { Suspense } from "react";

export default function ViewAdmissionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Admissions</h1>
        <p className="text-muted-foreground text-sm">
          View admission applications created by you.
        </p>
      </div>
      <Suspense>
        <AdminAdmissionView hideAddForm showFilters />
      </Suspense>
    </div>
  );
}
