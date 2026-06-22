import { AttendanceWindowsView } from "@/modules/admin/attendance-windows/attendance-windows-view";
import { Suspense } from "react";

const AttendanceWindowsPage = () => {
  return (
    <Suspense>
      <AttendanceWindowsView />
    </Suspense>
  );
};

export default AttendanceWindowsPage;
