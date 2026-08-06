import { FeePaymentView } from "@/modules/admission/fee-payment/fee-payment-view";
import React, { Suspense } from "react";

export default function FeePaymentPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fee Payment</h1>
        <p className="text-muted-foreground text-sm">
          Track and process admission fee payments. Payment gateway integration
          will be added here.
        </p>
      </div>
      <Suspense>
        <FeePaymentView />
      </Suspense>
    </div>
  );
}
