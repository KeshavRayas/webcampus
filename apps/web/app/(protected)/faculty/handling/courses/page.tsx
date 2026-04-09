import { FacultyHandlingCoursesView } from "@/modules/faculty/handling/faculty-handling-courses-view";
import { Suspense } from "react";

export default function FacultyHandlingCoursesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading courses...</div>}>
      <FacultyHandlingCoursesView />
    </Suspense>
  );
}
