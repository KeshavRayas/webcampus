import { FeePaymentView } from "@/modules/admission/fee-payment/fee-payment-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import React, { Suspense } from "react";

export default function FeePaymentPage() {
  return (
    <AdmissionConsoleShell
      title="Fees, moving with every admission."
      description="Track and process admission fee payments from one clear workspace."
    >
      <Suspense>
        <FeePaymentView />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
