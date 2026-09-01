import { AdmissionInstructorView } from "@/modules/admission/admission-instructor/admission-instructor-view";
import { RoleHero } from "@/modules/role-hero";
import React, { Suspense } from "react";

export default function AddAdmissionPage() {
  return (
    <div className="flex flex-col gap-6">
      <RoleHero
        eyebrow="Admission instructor"
        title="Create admissions, in real time."
        description="Create admission shells and track applications here."
        image="/dashboard-admission-instructor.png"
      />
      <Suspense>
        <AdmissionInstructorView />
      </Suspense>
    </div>
  );
}
