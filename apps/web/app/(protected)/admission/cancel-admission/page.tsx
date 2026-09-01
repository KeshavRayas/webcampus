import { CancelAdmissionView } from "@/modules/admission/cancel-admission/cancel-admission-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import { Suspense } from "react";

export default function CancelAdmissionPage() {
  return (
    <AdmissionConsoleShell
      title="Admissions, moving in real time."
      description="Review and manage admission cancellations from one clear workspace."
    >
      <Suspense>
        <CancelAdmissionView />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
