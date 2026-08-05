import { UploadDocsView } from "@/modules/admission/upload-docs/upload-docs-view";
import { Suspense } from "react";

export default function UploadDocumentsPage() {
  return (
    <Suspense>
      <UploadDocsView></UploadDocsView>
    </Suspense>
  );
}
