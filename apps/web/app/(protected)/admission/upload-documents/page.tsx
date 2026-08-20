import { AdmissionConsoleShell } from "@/modules/admission/shared/admission-console-shell";
import { UploadDocsView } from "@/modules/admission/upload-docs/upload-docs-view";
import { Suspense } from "react";

export default function UploadDocumentsPage() {
  return (
    <AdmissionConsoleShell
      title="Documents, ready when you are."
      description="Upload, review, and manage every document attached to an admission."
      className="admission-console-documents"
    >
      <Suspense>
        <UploadDocsView />
      </Suspense>
    </AdmissionConsoleShell>
  );
}
