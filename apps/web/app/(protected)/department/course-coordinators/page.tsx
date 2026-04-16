import { CourseCoordinatorsView } from "@/modules/department/course-coordinators/course-coordinators-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading coordinator assignment...</div>
      }
    >
      <CourseCoordinatorsView />
    </Suspense>
  );
};

export default Page;
