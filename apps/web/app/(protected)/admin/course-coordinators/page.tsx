import { AdminCourseCoordinatorsView } from "@/modules/admin/course-coordinators/course-coordinators-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading coordinator assignment...</div>
      }
    >
      <AdminCourseCoordinatorsView />
    </Suspense>
  );
};

export default Page;
