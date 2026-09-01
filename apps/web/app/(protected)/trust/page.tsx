import { TrustView } from "@/modules/trust/trust-view";
import { RoleHero } from "@/modules/role-hero";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <div className="flex flex-col gap-6">
      <RoleHero
        eyebrow="Trustee"
        title="Oversee, with perspective."
        description="A clear view of management quota admissions and institutional fee oversight."
        image="/dashboard-trust.png"
      />
      <Suspense fallback={<div className="p-4 text-sm">Loading Trust...</div>}>
        <TrustView />
      </Suspense>
    </div>
  );
};

export default Page;
