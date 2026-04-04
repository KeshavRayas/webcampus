import { AdminCourseMappingView } from "@/modules/admin/course-mapping/course-mapping-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading course mapping...</div>}
    >
      <AdminCourseMappingView />
    </Suspense>
  );
};

export default Page;
