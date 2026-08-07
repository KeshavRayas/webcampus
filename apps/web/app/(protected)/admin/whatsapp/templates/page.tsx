import { TemplateListView } from "@/modules/admin/whatsapp/template-list-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading templates...</div>}
    >
      <TemplateListView />
    </Suspense>
  );
};
export default Page;
