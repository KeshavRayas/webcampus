import { ApplicantAdmissionView } from "@/modules/admission/applicant/applicant-admission-view";
import React from "react";

export default function ApplicantDashboard() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applicant Portal</h1>
        <p className="text-muted-foreground text-sm">
          Please fill out your details and upload the required documents.
        </p>
      </div>
      <ApplicantAdmissionView />
    </div>
  );
}
