import { HODAttendanceWindowsView } from "@/modules/hod/attendance-windows/attendance-windows-view";
import { Suspense } from "react";

const HODAttendanceWindowsPage = () => {
  return (
    <Suspense>
      <HODAttendanceWindowsView />
    </Suspense>
  );
};

export default HODAttendanceWindowsPage;
