import { AdminCoursesView } from "@/modules/admin/courses/admin-courses-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading courses...</div>}>
      <AdminCoursesView />
    </Suspense>
  );
};

export default Page;
