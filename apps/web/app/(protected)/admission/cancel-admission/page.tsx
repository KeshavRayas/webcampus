import { CancelAdmissionView } from "@/modules/admission/cancel-admission/cancel-admission-view";
import { Suspense } from "react";

export default function CancelAdmissionPage() {
  return (
    <Suspense>
      <CancelAdmissionView />
    </Suspense>
  );
}
