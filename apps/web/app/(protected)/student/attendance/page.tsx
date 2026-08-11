import { StudentAttendanceView } from "@/modules/student/attendance/student-attendance-view";
import { Suspense } from "react";

export default function StudentAttendancePage() {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading attendance...</div>}
    >
      <StudentAttendanceView />
    </Suspense>
  );
}
