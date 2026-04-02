import { CourseApprovalsView } from "@/modules/department/course-approvals/course-approvals-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading course approvals...</div>}
    >
      <CourseApprovalsView />
    </Suspense>
  );
};

export default Page;
