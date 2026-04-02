import { AdminSemesterView } from "@/modules/admin/semester/admin-semester-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading semester...</div>}>
      <AdminSemesterView />
    </Suspense>
  );
};

export default Page;
