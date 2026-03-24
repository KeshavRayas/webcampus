import { AdminAdmissionUsersView } from "@/modules/admin/admission-users/admin-admission-users-view";
import React from "react";

export default function AdminAdmissionUsersPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admission Users</h1>
        <p className="text-muted-foreground text-sm">
          Manage isolated Admission Admin and Reviewer accounts for the portal.
        </p>
      </div>

      <AdminAdmissionUsersView />
    </div>
  );
}
