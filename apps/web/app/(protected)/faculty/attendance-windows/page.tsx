import { AttendanceWindowsView } from "@/modules/faculty/attendance-windows/attendance-windows-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading attendance windows...</div>
      }
    >
      <AttendanceWindowsView />
    </Suspense>
  );
};

export default Page;
