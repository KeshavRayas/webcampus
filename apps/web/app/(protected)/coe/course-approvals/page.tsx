import { CourseApprovalsView } from "@/modules/coe/course-approvals/course-approvals-view";
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
