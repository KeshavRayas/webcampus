import { DepartmentStudentView } from "@/modules/department/student/department-student-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense>
      <DepartmentStudentView />
    </Suspense>
  );
};

export default Page;
