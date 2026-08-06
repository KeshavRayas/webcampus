import { StudentMarksView } from "@/modules/student/marks/student-marks-view";
import { Suspense } from "react";

export default function StudentMarksPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading marks...</div>}>
      <StudentMarksView />
    </Suspense>
  );
}
