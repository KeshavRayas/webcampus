import { StudentHallTicketView } from "@/modules/student/hall-ticket/student-hall-ticket-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading hall ticket...</div>}
    >
      <StudentHallTicketView />
    </Suspense>
  );
};
export default Page;
