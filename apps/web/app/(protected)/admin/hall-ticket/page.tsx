import { AdminHallTicketView } from "@/modules/admin/hall-ticket/admin-hall-ticket-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm">Loading hall tickets...</div>}
    >
      <AdminHallTicketView />
    </Suspense>
  );
};
export default Page;
