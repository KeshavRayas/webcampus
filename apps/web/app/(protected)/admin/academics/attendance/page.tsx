import { AdminAttendanceReportView } from "@/modules/admin/academics/reports/admin-attendance-report-view";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Admin - Attendance Report | WebCampus",
};

export default function AdminAttendanceReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminAttendanceReportView />
    </Suspense>
  );
}
