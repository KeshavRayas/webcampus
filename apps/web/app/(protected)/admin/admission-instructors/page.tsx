import { AdminAdmissionInstructorsView } from "@/modules/admin/admission-instructors/admin-admission-instructors-view";
import React from "react";

export default function AdminAdmissionInstructorsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Admission Instructors
        </h1>
        <p className="text-muted-foreground text-sm">
          Create and manage Admission Instructor accounts for the portal.
        </p>
      </div>

      <AdminAdmissionInstructorsView />
    </div>
  );
}
