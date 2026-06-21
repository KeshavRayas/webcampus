"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Button } from "@webcampus/ui/components/button";
import { Label } from "@webcampus/ui/components/label";
import { Upload } from "lucide-react";
import React, { useId, useRef } from "react";

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "NA";
  }

  if (parts.length === 1) {
    return (parts[0] ?? "NA").slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? "N"}${parts[1]?.[0] ?? "A"}`.toUpperCase();
};

type UserPhotoUploadProps = {
  label: string;
  personName: string;
  previewUrl?: string | null;
  currentImageUrl?: string | null;
  selectedFileName?: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
};

export const UserPhotoUpload = ({
  label,
  personName,
  previewUrl,
  currentImageUrl,
  selectedFileName,
  onChange,
  hint,
}: UserPhotoUploadProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeImageUrl = previewUrl || currentImageUrl || undefined;

  const statusText = selectedFileName
    ? selectedFileName
    : currentImageUrl
      ? "Existing photo will be kept unless you choose a new one."
      : "No photo selected yet.";

  return (
    <div className="space-y-3">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="bg-muted/20 flex flex-col gap-4 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 border">
          <AvatarImage
            src={activeImageUrl}
            alt={`${personName} profile photo`}
          />
          <AvatarFallback className="text-sm font-semibold">
            {getInitials(personName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-3">
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onChange}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {selectedFileName || currentImageUrl
                ? "Change Photo"
                : "Browse Photo"}
            </Button>
            <span className="text-muted-foreground truncate text-sm">
              {statusText}
            </span>
          </div>

          <p className="text-muted-foreground text-xs">
            {hint || "Upload a square photo for the cleanest preview."}
          </p>
        </div>
      </div>
    </div>
  );
};
