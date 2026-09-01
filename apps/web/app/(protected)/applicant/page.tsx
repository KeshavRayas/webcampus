import { ApplicantAdmissionView } from "@/modules/admission/applicant/applicant-admission-view";
import { RoleHero } from "@/modules/role-hero";
import React from "react";

export default function ApplicantDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <RoleHero
        eyebrow="Applicant portal"
        title="Your application, in motion."
        description="Complete your details and upload documents to finish."
        image="/dashboard-applicant.png"
      />
      <ApplicantAdmissionView />
    </div>
  );
}
