"use client";
"use client";

import { authClient } from "@/lib/auth-client";
import { AdminAdmissionView } from "@/modules/admission/admin/admin-admission-view";
import { ApplicantAdmissionView } from "@/modules/admission/applicant/applicant-admission-view";
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Suspense>
        {isApplicant ? (
          <ApplicantAdmissionView />
        ) : (
          <AdminAdmissionView admissionSemestersOnly />
        )}
      </Suspense>
    </div>
  );
}
