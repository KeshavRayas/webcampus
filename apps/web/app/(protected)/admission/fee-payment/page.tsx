import { FeePaymentView } from "@/modules/admission/fee-payment/fee-payment-view";
import { Suspense } from "react";

export default function FeePaymentPage() {
  return (
    <Suspense>
      <FeePaymentView />
    </Suspense>
  );
}
