import { RegistrationTrackingView } from "@/modules/admin/registration-tracking/registration-tracking-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading registration tracking...</div>
      }
    >
      <RegistrationTrackingView />
    </Suspense>
  );
};

export default Page;
