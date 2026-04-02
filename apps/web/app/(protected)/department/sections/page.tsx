import { DepartmentSectionView } from "@/modules/department/section/department-section-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading sections...</div>}>
      <DepartmentSectionView />
    </Suspense>
  );
};

export default Page;
