import { CourseApprovalsView } from "@/modules/admin/course-approvals/course-approvals-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading Approvals...</div>}
    >
      <CourseApprovalsView />
    </Suspense>
  );
};

export default Page;
