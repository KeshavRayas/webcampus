import { AdmissionReportView } from "@/modules/admission/reports/admission-report-view";
import { ReportSubTabs } from "@/modules/admission/reports/report-sub-tabs";
import React, { Suspense } from "react";

export default function FeeReportPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fee Reports</h1>
        <p className="text-muted-foreground text-sm">
          Generate fee reports filtered by semester and advanced criteria.
        </p>
      </div>
      <ReportSubTabs />
      <Suspense>
        <AdmissionReportView reportType="fee" />
      </Suspense>
    </div>
  );
}
