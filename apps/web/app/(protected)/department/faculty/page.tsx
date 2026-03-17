import { DepartmentFacultyView } from "@/modules/department/faculty/department-faculty-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense>
      <DepartmentFacultyView />
    </Suspense>
  );
};

export default Page;
