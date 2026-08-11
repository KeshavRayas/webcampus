import { HallTicketVerificationView } from "@/modules/verification/hall-ticket-verification-view";
import { Suspense } from "react";

export default function FacultyVerificationPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading...</div>}>
      <HallTicketVerificationView />
    </Suspense>
  );
}
