import { CoursesView } from "@/modules/department/courses/courses-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading courses...</div>}>
      <CoursesView />
    </Suspense>
  );
};

export default Page;
