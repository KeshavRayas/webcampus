"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import { Label } from "@webcampus/ui/components/label";
import { Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { UploadDocsResponse } from "./upload-docs-columns";
import { useUploadDocuments } from "./use-upload-documents";

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024;

const getStatusVariant = (status: UploadDocsResponse["status"]) => {
  switch (status) {
    case "APPROVED":
      return "default";
    case "SUBMITTED":
      return "secondary";
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
};

const getInitials = (name?: string | null) => {
  if (!name) return "NA";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "NA";

  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

type Props = {
  admission: UploadDocsResponse;
};

type DocumentCardProps = {
  title: string;
  field: string;
  currentFile?: string | null;
  selectedFile?: File | null;
  onFileChange: (field: string, file: File | null) => void;
};

const isImageFile = (
  field: string,
  file?: File | null,
  url?: string | null
) => {
  if (file) return file.type.startsWith("image/");
  if (field === "photo") return true;

  return /\.(jpg|jpeg|png)(\?|$)/i.test(url ?? "");
};

function DocumentPreview({
  field,
  file,
  url,
}: {
  field: string;
  file?: File | null;
  url?: string | null;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);
    setObjectUrl(nextObjectUrl);

    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [file]);

  const previewUrl = objectUrl || url;
  if (!previewUrl) return null;

  if (isImageFile(field, file, url)) {
    return (
      <div className="bg-muted/20 overflow-hidden rounded-lg border">
        <img
          src={previewUrl}
          alt={`${field} preview`}
          className="h-40 w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <iframe
        src={previewUrl}
        title={`${field} preview`}
        className="h-64 w-full"
      />
    </div>
  );
}

function DocumentCard({
  title,
  field,
  currentFile,
  selectedFile,
  onFileChange,
}: DocumentCardProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const displayedFile = selectedFile || currentFile;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">{title}</p>

        {currentFile ? (
          <Badge variant="default">Uploaded</Badge>
        ) : (
          <Badge variant="outline">Missing</Badge>
        )}
      </div>

      <DocumentPreview field={field} file={selectedFile} url={currentFile} />

      {currentFile && !selectedFile && (
        <a
          href={currentFile}
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm hover:underline"
        >
          View Current File
        </a>
      )}

      <div className="bg-muted/20 flex items-center gap-3 rounded-lg border border-dashed p-3">
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file && file.size > MAX_DOCUMENT_SIZE) {
              toast.error(`${title} must be less than 2 MB.`);
              onFileChange(field, null);
              event.target.value = "";
              return;
            }
            onFileChange(field, file);
            event.target.value = "";
          }}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {displayedFile ? "Change File" : "Browse File"}
        </Button>

        <Label
          htmlFor={inputId}
          className="text-muted-foreground truncate text-sm"
        >
          {selectedFile?.name ||
            (currentFile
              ? "Existing file will be kept unless changed."
              : "No file selected yet.")}
        </Label>
      </div>
    </div>
  );
}

export function UploadDocsActions({ admission }: Props) {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [open, setOpen] = useState(false);
  const { uploadDocumentsAsync, isPending } = useUploadDocuments();

  const setFile = (field: string, file: File | null) => {
    setFiles((prev) => ({
      ...prev,
      [field]: file,
    }));
  };

  const fullName = admission.nameAsPer10th?.trim() || "";

  const hasFiles = Object.values(files).some(Boolean);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setFiles({});
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage Documents
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Admission Documents</DialogTitle>

          <DialogDescription>{admission.applicationId}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <Avatar className="h-28 w-28">
                <AvatarImage src={admission.photo ?? undefined} />

                <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
              </Avatar>

              <div className="space-y-2 text-center">
                <h3 className="text-lg font-semibold">{fullName || "-"}</h3>

                <p className="text-muted-foreground break-all text-sm">
                  {admission.primaryEmail}
                </p>

                <Badge variant={getStatusVariant(admission.status)}>
                  {admission.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="text-muted-foreground text-sm">Application ID</p>

                <p className="font-medium">{admission.applicationId}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Documents</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DocumentCard
                  title="Passport Photo"
                  field="photo"
                  currentFile={admission.photo}
                  selectedFile={files.photo}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="Aadhaar Card"
                  field="aadharCard"
                  currentFile={admission.aadharCard}
                  selectedFile={files.aadharCard}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="10th Marks Card"
                  field="class10thMarksPdf"
                  currentFile={admission.class10thMarksPdf}
                  selectedFile={files.class10thMarksPdf}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="12th Marks Card"
                  field="class12thMarksPdf"
                  currentFile={admission.class12thMarksPdf}
                  selectedFile={files.class12thMarksPdf}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="Diploma Marks Card"
                  field="diplomaMarksPdf"
                  currentFile={admission.diplomaMarksPdf}
                  selectedFile={files.diplomaMarksPdf}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="Study Certificate"
                  field="studyCertificate"
                  currentFile={admission.studyCertificate}
                  selectedFile={files.studyCertificate}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="Transfer Certificate"
                  field="transferCertificate"
                  currentFile={admission.transferCertificate}
                  selectedFile={files.transferCertificate}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="Caste Certificate"
                  field="casteCertificate"
                  currentFile={admission.casteCertificate}
                  selectedFile={files.casteCertificate}
                  onFileChange={setFile}
                />

                <DocumentCard
                  title="Embassy Permission Letter"
                  field="embassyPermissionLetter"
                  currentFile={admission.embassyPermissionLetter}
                  selectedFile={files.embassyPermissionLetter}
                  onFileChange={setFile}
                />

                {admission.disability && (
                  <DocumentCard
                    title="Disability Certificate"
                    field="disabilityCertificate"
                    currentFile={admission.disabilityCertificate}
                    selectedFile={files.disabilityCertificate}
                    onFileChange={setFile}
                  />
                )}
              </div>

              <DialogFooter className="mt-8 border-t pt-6">
                <Button variant="outline" onClick={() => setFiles({})}>
                  Cancel
                </Button>

                <Button
                  disabled={!hasFiles || isPending}
                  onClick={async () => {
                    await uploadDocumentsAsync({
                      id: admission.id,
                      files,
                    });
                    setOpen(false);
                  }}
                >
                  {isPending ? "Saving..." : "Save Documents"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
