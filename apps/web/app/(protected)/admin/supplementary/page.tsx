import { SupplementaryAdminView } from "@/modules/admin/supplementary/supplementary-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading supplementary...</div>}
    >
      <SupplementaryAdminView />
    </Suspense>
  );
};

export default Page;
