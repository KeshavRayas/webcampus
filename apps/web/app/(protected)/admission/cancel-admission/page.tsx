import { CancelAdmissionView } from "@/modules/admission/cancel-admission/cancel-admission-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import { Suspense } from "react";

export default function CancelAdmissionPage() {
  return (
    <AdmissionConsoleShell
      title="Cancellations, handled with care."
      description="Review applications, record a reason, and keep the admission trail complete."
    >
      <Suspense>
        <CancelAdmissionView />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
