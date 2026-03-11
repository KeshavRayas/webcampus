import { AdminAdmissionView } from "@/modules/admission/admin/admin-admission-view";
import React from "react";

export default function ViewAdmissionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Admissions Management
        </h1>
        <p className="text-muted-foreground text-sm">
          Select a semester to view current applicants and create new admission
          shells.
        </p>
      </div>
      {/* Mount our new, semester-aware view! */}
      <AdminAdmissionView hideAddForm={true} />
    </div>
  );
}
