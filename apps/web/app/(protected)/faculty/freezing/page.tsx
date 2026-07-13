import { FreezingView } from "@/modules/faculty/freezing/freezing-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading freezing data...</div>}
    >
      <FreezingView />
    </Suspense>
  );
};

export default Page;
