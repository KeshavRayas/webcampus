import { FacultyAttendanceView } from "@/modules/faculty/attendance/faculty-attendance-view";
import { Suspense } from "react";

export default function FacultyAttendancePage() {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading attendance...</div>}
    >
      <FacultyAttendanceView />
    </Suspense>
  );
}
