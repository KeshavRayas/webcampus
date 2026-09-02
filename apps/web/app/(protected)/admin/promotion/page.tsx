import { PromotionView } from "@/modules/admin/promotion/promotion-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading promotion...</div>}
    >
      <PromotionView />
    </Suspense>
  );
};

export default Page;
