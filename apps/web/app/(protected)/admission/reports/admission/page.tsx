import { AdmissionReportView } from "@/modules/admission/reports/admission-report-view";
import { ReportSubTabs } from "@/modules/admission/reports/report-sub-tabs";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import React, { Suspense } from "react";

export default function AdmissionReportPage() {
  return (
    <AdmissionConsoleShell
      title="Admissions, moving in real time."
      description="Generate clear admissions reports from the same filtered workspace."
    >
      <ReportSubTabs />
      <Suspense>
        <AdmissionReportView reportType="admission" />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
