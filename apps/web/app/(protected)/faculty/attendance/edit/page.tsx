import { FacultyAttendanceEditView } from "@/modules/faculty/attendance/faculty-attendance-edit-view";
import { Suspense } from "react";

export const metadata = {
  title: "Edit Attendance | Faculty",
  description: "Modify existing attendance sessions",
};

export default function FacultyAttendanceEditPage() {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading attendance...</div>}
    >
      <FacultyAttendanceEditView />
    </Suspense>
  );
}
