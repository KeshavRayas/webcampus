import { TrustView } from "@/modules/trust/trust-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading Trust...</div>}>
      <TrustView />
    </Suspense>
  );
};

export default Page;
