import { CourseMappingView } from "@/modules/department/course-mapping/course-mapping-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading course mapping...</div>}>
      <CourseMappingView />
    </Suspense>
  );
};

export default Page;
