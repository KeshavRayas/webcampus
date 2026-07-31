import { HodAttendanceReportView } from "@/modules/hod/attendance/hod-attendance-report-view";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "HOD - Attendance Report | WebCampus",
};

export default function HodAttendanceReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HodAttendanceReportView />
    </Suspense>
  );
}
