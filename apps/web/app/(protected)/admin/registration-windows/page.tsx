import { RegistrationWindowsView } from "@/modules/admin/registration-windows/registration-windows-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading registration windows...</div>
      }
    >
      <RegistrationWindowsView />
    </Suspense>
  );
};

export default Page;
