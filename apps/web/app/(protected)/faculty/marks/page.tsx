import { MarksView } from "@/modules/faculty/marks/marks-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading marks entry dashboard...</div>
      }
    >
      <MarksView />
    </Suspense>
  );
};

export default Page;
