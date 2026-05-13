import { AttendanceFreezeView } from "@/modules/faculty/attendance-freeze/attendance-freeze-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading attendance freeze...</div>}
    >
      <AttendanceFreezeView />
    </Suspense>
  );
};

export default Page;
