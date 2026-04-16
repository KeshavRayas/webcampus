import { QuestionPaperDashboard } from "@/modules/faculty/question-paper-setup/question-paper-dashboard";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm">Loading question paper setup...</div>
      }
    >
      <QuestionPaperDashboard />
    </Suspense>
  );
};

export default Page;
