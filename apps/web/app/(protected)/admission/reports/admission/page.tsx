import { AdmissionReportView } from "@/modules/admission/reports/admission-report-view";
import { ReportSubTabs } from "@/modules/admission/reports/report-sub-tabs";
import React, { Suspense } from "react";

export default function AdmissionReportPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admission Reports</h1>
        <p className="text-muted-foreground text-sm">
          Generate admissions reports filtered by semester and advanced
          criteria.
        </p>
      </div>
      <ReportSubTabs />
      <Suspense>
        <AdmissionReportView reportType="admission" />
      </Suspense>
    </div>
  );
}
