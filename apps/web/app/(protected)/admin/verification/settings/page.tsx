import { AdminVerificationSettingsView } from "@/modules/admin/verification/admin-verification-settings-view";
import { Suspense } from "react";

export default function AdminVerificationSettingsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading...</div>}>
      <AdminVerificationSettingsView />
    </Suspense>
  );
}
