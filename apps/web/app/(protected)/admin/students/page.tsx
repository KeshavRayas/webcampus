import { AdminStudentsView } from "@/modules/admin/students/admin-students-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading students...</div>}>
      <AdminStudentsView />
    </Suspense>
  );
};

export default Page;
