import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import { UploadDocsView } from "@/modules/admission/upload-docs/upload-docs-view";
import { Suspense } from "react";

export default function UploadDocumentsPage() {
  return (
    <AdmissionConsoleShell
      title="Admissions, moving in real time."
      description="Keep every admission document organized and ready for review."
    >
      <Suspense>
        <UploadDocsView />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
