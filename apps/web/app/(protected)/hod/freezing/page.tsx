import { HODAttendanceWindowsView } from "@/modules/hod/attendance-windows/attendance-windows-view";
import { Suspense } from "react";

const Page = () => {
  return (
    <Suspense>
      <HODAttendanceWindowsView />
    </Suspense>
  );
};

export default Page;
