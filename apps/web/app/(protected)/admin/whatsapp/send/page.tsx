import { SendView } from "@/modules/admin/whatsapp/send-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading send wizard...</div>}
    >
      <SendView />
    </Suspense>
  );
};
export default Page;
