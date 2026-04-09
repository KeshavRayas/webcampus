import { FacultyHandlingLabView } from "@/modules/faculty/handling/faculty-handling-lab-view";
import { Suspense } from "react";

export default function FacultyHandlingLabPage() {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading lab assignments...</div>}
    >
      <FacultyHandlingLabView />
    </Suspense>
  );
}
