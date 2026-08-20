"use client";
"use client";

import { authClient } from "@/lib/auth-client";
import { AdminAdmissionView } from "@/modules/admission/admin/admin-admission-view";
import { ApplicantAdmissionView } from "@/modules/admission/applicant/applicant-admission-view";
import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import React, { Suspense } from "react";

export default function AdmissionPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-12">
        <p className="text-muted-foreground">Loading admission dashboard...</p>
      </div>
    );
  }

  const isApplicant = session.user.role === "applicant";
  return (
    <AdmissionConsoleShell
      title="Admissions, moving in real time."
      description="Apply once, track every step, and stay updated from start to finish."
    >
      <Suspense>
        {isApplicant ? <ApplicantAdmissionView /> : <AdminAdmissionView />}
      </Suspense>
    </AdmissionConsoleShell>
  );
}
