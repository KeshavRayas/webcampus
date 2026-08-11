import { CampaignsView } from "@/modules/admin/whatsapp/campaigns-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading reports...</div>}>
      <CampaignsView />
    </Suspense>
  );
};
export default Page;
