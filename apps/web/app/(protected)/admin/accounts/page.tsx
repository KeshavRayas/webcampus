import { AccountsView } from "@/modules/admin/accounts-users/accounts-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading Accounts users...</div>}
    >
      <AccountsView />
    </Suspense>
  );
};

export default Page;
