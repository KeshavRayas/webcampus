import { FinanceView } from "@/modules/admin/finance-users/finance-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading Finance users...</div>}>
      <FinanceView />
    </Suspense>
  );
};

export default Page;
