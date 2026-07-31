import { AdminCondonationReportView } from "@/modules/admin/academics/reports/admin-condonation-report-view";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Admin - Condonation Report | WebCampus",
};

export default function AdminCondonationReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminCondonationReportView />
    </Suspense>
  );
}
