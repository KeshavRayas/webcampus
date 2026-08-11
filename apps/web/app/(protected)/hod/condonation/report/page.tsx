import { HodCondonationReportView } from "@/modules/hod/condonation/hod-condonation-report-view";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "HOD - Condonation Report | WebCampus",
};

export default function HodCondonationReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HodCondonationReportView />
    </Suspense>
  );
}
