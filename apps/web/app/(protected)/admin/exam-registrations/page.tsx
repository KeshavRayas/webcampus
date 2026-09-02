import { ExamRegistrationsView } from "@/modules/admin/exam-registrations/exam-registrations-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading exam registrations...</div>
      }
    >
      <ExamRegistrationsView />
    </Suspense>
  );
};

export default Page;
