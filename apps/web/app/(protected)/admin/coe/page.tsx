import { CoeView } from "@/modules/admin/coe/coe-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading COE management...</div>}
    >
      <CoeView />
    </Suspense>
  );
};

export default Page;
