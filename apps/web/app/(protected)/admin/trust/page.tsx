import { TrustView } from "@/modules/admin/trust-users/trust-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading Trust users...</div>}
    >
      <TrustView />
    </Suspense>
  );
};

export default Page;
