import { AdminFacultyView } from "@/modules/admin/faculty/admin-faculty-view";
import React from "react";

export default function AdminFacultyPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Faculty Management
        </h1>
        <p className="text-muted-foreground text-sm">
          Select a department to view and manage its faculty members.
        </p>
      </div>

      {/* The main interactive view we just built */}
      <AdminFacultyView />
    </div>
  );
}
