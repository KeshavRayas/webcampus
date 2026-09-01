import { AdmissionSetupView } from "@/modules/admission/setup/admission-setup-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import { AdmissionTabFilterStrip } from "@/modules/admission/shared/admission-tab-filter-strip";
import { Suspense } from "react";

export default function AdmissionSetupPage() {
  return (
    <AdmissionConsoleShell
      title="Admissions, moving in real time."
      description="Keep admission modes, quotas, and categories ready for every application."
    >
      <AdmissionTabFilterStrip />
      <Suspense>
        <AdmissionSetupView />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
