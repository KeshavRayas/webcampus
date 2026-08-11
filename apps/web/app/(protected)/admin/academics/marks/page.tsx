import { AdminMarksReportView } from "@/modules/admin/academics/reports/admin-marks-report-view";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Admin - Marks Report | WebCampus",
};

export default function AdminMarksReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminMarksReportView />
    </Suspense>
  );
}
