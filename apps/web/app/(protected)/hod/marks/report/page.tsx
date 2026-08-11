import { HodMarksReportView } from "@/modules/hod/marks/hod-marks-report-view";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "HOD - Marks Report | WebCampus",
};

export default function HodMarksReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HodMarksReportView />
    </Suspense>
  );
}
