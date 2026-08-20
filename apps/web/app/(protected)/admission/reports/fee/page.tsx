import { AdmissionReportView } from "@/modules/admission/reports/admission-report-view";
import { ReportSubTabs } from "@/modules/admission/reports/report-sub-tabs";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import React, { Suspense } from "react";

export default function FeeReportPage() {
  return (
    <AdmissionConsoleShell
      title="Fees, tracked end to end."
      description="Generate fee reports filtered by semester and advanced criteria."
    >
      <ReportSubTabs />
      <Suspense>
        <AdmissionReportView reportType="fee" />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
