"use client";

import { authClient } from "@/lib/auth-client";
import { AdmissionView } from "@/modules/admission/admin/admission-view";
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
  const heading = isApplicant ? "Applicant Portal" : "Admissions Portal";
  const description = isApplicant
    ? "Fill out your application and complete the admission payment details."
    : "Create student admission shells and track application status.";

  return (
    <AdmissionConsoleShell
      title={heading}
      description={description}
      showHero
    >
      <Suspense>
        {isApplicant ? (
          <ApplicantAdmissionView />
        ) : (
          <AdmissionView showFilters />
        )}
      </Suspense>
    </AdmissionConsoleShell>
  );
}
