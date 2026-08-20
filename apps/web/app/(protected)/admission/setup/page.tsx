import { AdmissionSetupView } from "@/modules/admission/setup/admission-setup-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import React from "react";

export default function AdmissionSetupPage() {
  return (
    <AdmissionConsoleShell
      title="Admission setup, made simple."
      description="Shape the terms, modes, quotas, and categories your office works with."
    >
      <AdmissionSetupView />
    </AdmissionConsoleShell>
  );
}
