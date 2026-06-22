"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { Progress } from "@webcampus/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@webcampus/ui/components/tabs";
import axios, { isAxiosError } from "axios";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

type ApplicantAdmissionData = {
  applicationId: string;
  modeOfAdmission: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
  department?: { name: string };
  categoryClaimed?: string;
  categoryAllotted?: string;
  quota?: string;
};

type StepKey = "admission" | "personal" | "education" | "parent" | "review";

const STEP_ORDER: StepKey[] = [
  "admission",
  "personal",
  "education",
  "parent",
  "review",
];

const STEP_LABELS: Record<StepKey, string> = {
  admission: "Admission Details",
  personal: "Personal Information",
  education: "Education Details",
  parent: "Parent / Guardian Details",
  review: "Review",
};

export const ApplicantAdmissionView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSameAddress, setIsSameAddress] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>("admission");
  const [hostelEnabled, setHostelEnabled] = useState(false);
  const [nriEnabled, setNriEnabled] = useState(false);
  const [disabilityEnabled, setDisabilityEnabled] = useState(false);
  const [economicallyBackwardEnabled, setEconomicallyBackwardEnabled] =
    useState(false);
  const [class12Enabled, setClass12Enabled] = useState(true);
  const [diplomaEnabled, setDiplomaEnabled] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>(
    {}
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const filePreviewRef = useRef<string | null>(null);
  const sectionRefs = useRef<Record<StepKey, HTMLDivElement | null>>({
    admission: null,
    personal: null,
    education: null,
    parent: null,
    review: null,
  });

  // Fetch the applicant's existing shell
  const {
    data: admission,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admission-me"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<ApplicantAdmissionData>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/me`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return null;
    },
    retry: false,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!class12Enabled && !diplomaEnabled) {
      toast.error("Please fill either Class 12 / PUC or Diploma details.");
      return;
    }
    setIsSubmitting(true);

    // We must use FormData because we are sending files alongside text!
    const formData = new FormData(e.currentTarget);
    formData.set("hostel", hostelEnabled ? "true" : "false");
    formData.set("nri", nriEnabled ? "true" : "false");
    formData.set("disability", disabilityEnabled ? "true" : "false");
    formData.set(
      "economicallyBackward",
      economicallyBackwardEnabled ? "true" : "false"
    );
    formData.set("hasClass12", class12Enabled ? "true" : "false");
    formData.set("hasDiploma", diplomaEnabled ? "true" : "false");

    try {
      await axios.put(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/submit`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      toast.success("Application submitted successfully!");
      refetch(); // Refresh the screen to show the success state
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        toast.error(
          error.response?.data?.message || "Failed to submit application"
        );
      } else {
        toast.error("Failed to submit application");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeIndex = STEP_ORDER.indexOf(activeStep);
  const progressValue = ((activeIndex + 1) / STEP_ORDER.length) * 100;

  const clearPreview = () => {
    if (filePreviewRef.current) {
      URL.revokeObjectURL(filePreviewRef.current);
      filePreviewRef.current = null;
    }
    setPhotoPreview(null);
  };

  const handleFileSelect = (name: string, file: File | null) => {
    setSelectedFiles((current) => ({
      ...current,
      [name]: file?.name || "",
    }));

    if (name === "photo") {
      clearPreview();
      if (file) {
        const nextPreview = URL.createObjectURL(file);
        filePreviewRef.current = nextPreview;
        setPhotoPreview(nextPreview);
      }
    }
  };

  const saveAndNext = (step: StepKey) => {
    const nextIndex = STEP_ORDER.indexOf(step) + 1;
    const nextStep = STEP_ORDER[
      Math.min(nextIndex, STEP_ORDER.length - 1)
    ] as StepKey;
    setActiveStep(nextStep);
  };

  const goBack = (step: StepKey) => {
    const nextIndex = STEP_ORDER.indexOf(step) - 1;
    const previousStep = STEP_ORDER[Math.max(nextIndex, 0)] as StepKey;
    setActiveStep(previousStep);
  };

  const handleReviewStep = () => {
    if (!class12Enabled && !diplomaEnabled) {
      toast.error("Please fill either Class 12 / PUC or Diploma details.");
      return;
    }
    setActiveStep("review");
  };

  useEffect(() => {
    return () => {
      if (filePreviewRef.current) {
        URL.revokeObjectURL(filePreviewRef.current);
      }
    };
  }, []);

  const FilePicker = ({
    name,
    label,
    accept,
    required = false,
    helperText,
    disabled = false,
    showPreview = false,
  }: {
    name: string;
    label: string;
    accept: string;
    required?: boolean;
    helperText?: string;
    disabled?: boolean;
    showPreview?: boolean;
  }) => {
    const selectedName = selectedFiles[name] || "";
    const inputId = `${name}-input`;
    return (
      <div className="space-y-2">
        <Label htmlFor={inputId}>
          {label}
          {required ? " *" : ""}
        </Label>
        <div className="bg-background flex flex-wrap items-center gap-3 rounded-md border p-3">
          <Input
            id={inputId}
            name={name}
            type="file"
            accept={accept}
            required={required}
            disabled={disabled}
            onChange={(event) =>
              handleFileSelect(name, event.target.files?.[0] || null)
            }
            className="sr-only"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById(inputId)?.click()}
            disabled={disabled}
          >
            {selectedName ? "Change File" : "Choose File"}
          </Button>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
            {selectedName || "No file chosen"}
          </span>
        </div>
        {showPreview && photoPreview ? (
          <div className="mt-2">
            <img
              src={photoPreview}
              alt="Uploaded preview"
              className="h-24 w-24 rounded-lg border object-cover"
            />
          </div>
        ) : null}
        {helperText ? (
          <p className="text-muted-foreground text-xs">{helperText}</p>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <p className="text-muted-foreground animate-pulse">
          Loading your application profile...
        </p>
      </div>
    );
  }

  if (error) {
    const errorMessage = isAxiosError(error)
      ? error.response?.data?.message || error.message
      : "An unexpected error occurred";
    return (
      <div className="border-destructive bg-destructive/10 text-destructive rounded-lg border p-6 text-center">
        <h3 className="text-lg font-bold">Failed to load application</h3>
        <p className="mt-2 text-sm">{errorMessage}</p>
      </div>
    );
  }

  if (!admission) {
    return <div className="p-6 text-center">No admission profile found.</div>;
  }

  if (admission.status !== "PENDING") {
    return (
      <div className="bg-secondary/20 flex flex-col items-center justify-center rounded-lg border p-12 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Application Submitted!
        </h2>
        <p className="text-muted-foreground mt-2">
          Your application (ID: {admission.applicationId}) is currently under
          review by the administration.
        </p>
      </div>
    );
  }

  const handleSameAsCurrentAddress = (checked: boolean) => {
    setIsSameAddress(checked);

    // List of the field suffixes we need to copy
    const fields = [
      "Address",
      "Area",
      "City",
      "District",
      "State",
      "Country",
      "Pincode",
    ];

    fields.forEach((field) => {
      // Find the input elements in the DOM by their name attribute
      const currentInput = document.querySelector(
        `[name="current${field}"]`
      ) as HTMLInputElement;
      const permanentInput = document.querySelector(
        `[name="permanent${field}"]`
      ) as HTMLInputElement;

      if (currentInput && permanentInput) {
        if (checked) {
          // Copy the value from current to permanent
          permanentInput.value = currentInput.value;
          // Optional: Make it read-only so they don't accidentally edit it while checked
          permanentInput.readOnly = true;
        } else {
          // Clear the value if unchecked
          permanentInput.value = "";
          permanentInput.readOnly = false;
        }
      }
    });
  };

  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium">Complete Your Application</h3>
          <p className="text-muted-foreground text-sm">
            Application ID:{" "}
            <span className="font-bold">{admission.applicationId}</span> | Mode:{" "}
            <span className="font-bold">{admission.modeOfAdmission}</span>
          </p>
        </div>

        <Tabs
          value={activeStep}
          onValueChange={(value) => setActiveStep(value as StepKey)}
          className="space-y-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 p-1 md:grid-cols-5">
            {STEP_ORDER.map((step) => (
              <TabsTrigger
                key={step}
                value={step}
                className="text-xs md:text-sm"
              >
                {STEP_LABELS[step]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Progress</span>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <Progress value={progressValue} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* ADMISSION DETAILS */}
        <div
          ref={(node) => {
            sectionRefs.current.admission = node;
          }}
          className={
            activeStep === "admission" ? "space-y-6" : "hidden space-y-6"
          }
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              1. Admission Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-2 md:col-span-3">
              <Label>Branch</Label>
              <div className="bg-muted text-muted-foreground border-input flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm">
                {admission.department?.name || "Assigned Branch"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-2 md:col-span-4">
              <Label>Category Claimed</Label>
              <div className="bg-muted text-muted-foreground border-input flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm">
                {admission.categoryClaimed || "Not Set"}
              </div>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label>Category Allotted</Label>
              <div className="bg-muted text-muted-foreground border-input flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm">
                {admission.categoryAllotted || "Not Set"}
              </div>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label>Quota</Label>
              <div className="bg-muted text-muted-foreground border-input flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm">
                {admission.quota || "Not Set"}
              </div>
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="entranceExamRank">Entrance Exam Rank *</Label>
              <Input
                id="entranceExamRank"
                name="entranceExamRank"
                type="number"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="originalAdmissionOrderNumber">
                Original Admission Order No. *
              </Label>
              <Input
                id="originalAdmissionOrderNumber"
                name="originalAdmissionOrderNumber"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="originalAdmissionOrderDate">
                Original Admission Order Date *
              </Label>
              <Input
                id="originalAdmissionOrderDate"
                name="originalAdmissionOrderDate"
                type="date"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="feePayable">Fee Payable (₹) *</Label>
              <Input id="feePayable" name="feePayable" type="number" required />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="feePaid">Fee Paid (₹) *</Label>
              <Input id="feePaid" name="feePaid" type="number" required />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="hostel-toggle">Hostel Required *</Label>
              <input
                type="hidden"
                name="hostel"
                value={hostelEnabled ? "true" : "false"}
              />
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id="hostel-toggle"
                  checked={hostelEnabled}
                  onCheckedChange={(checked) =>
                    setHostelEnabled(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="hostel-toggle"
                  className="cursor-pointer text-sm font-medium"
                >
                  Staying in hostel
                </Label>
              </div>
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="hostelRoomNumber">Hostel Room Number</Label>
              <Input
                id="hostelRoomNumber"
                name="hostelRoomNumber"
                type="number"
                disabled={!hostelEnabled}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => saveAndNext("admission")}>
              Save and Continue
            </Button>
          </div>
        </div>

        {/* PERSONAL INFORMATION */}
        <div
          ref={(node) => {
            sectionRefs.current.personal = node;
          }}
          className={
            activeStep === "personal" ? "space-y-6" : "hidden space-y-6"
          }
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              2. Personal Information
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="nameAsPer10th">
                Full Name as per 10th Grade Marks Card *
              </Label>
              <Input
                id="nameAsPer10th"
                name="nameAsPer10th"
                required
                placeholder="Robert J Oppenheimer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input id="dob" name="dob" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group *</Label>
              <Select name="bloodGroup" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                    (bg) => (
                      <SelectItem key={bg} value={bg}>
                        {bg}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select name="gender" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <FilePicker
                name="photo"
                label="Passport Size Photo (Image)"
                accept="image/*"
                required
                showPreview
              />
            </div>

            {/* Contact Info */}
            <div className="space-y-2">
              <Label htmlFor="primaryPhoneNumber">Primary Phone Number *</Label>
              <Input
                id="primaryPhoneNumber"
                name="primaryPhoneNumber"
                type="tel"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryPhoneNumber">
                Secondary Phone Number *
              </Label>
              <Input
                id="secondaryPhoneNumber"
                name="secondaryPhoneNumber"
                type="tel"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactNumber">
                Emergency Contact Number *
              </Label>
              <Input
                id="emergencyContactNumber"
                name="emergencyContactNumber"
                type="tel"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-1 lg:col-span-1">
              <Label htmlFor="primaryEmail">Primary Email Address *</Label>
              <Input
                id="primaryEmail"
                name="primaryEmail"
                type="email"
                required
                placeholder="@bmsce.ac.in"
              />
            </div>
            <div className="space-y-2 md:col-span-1 lg:col-span-1">
              <Label htmlFor="secondaryEmail">Secondary Email Address *</Label>
              <Input
                id="secondaryEmail"
                name="secondaryEmail"
                type="email"
                required
                placeholder="Personal Email"
              />
            </div>

            {/* Current Address */}
            <div className="md:col-span-2 lg:col-span-3">
              <h4 className="mb-2 mt-4 text-lg font-semibold">
                Current Address
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="currentAddress">Address Line *</Label>
                  <Input id="currentAddress" name="currentAddress" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentArea">Area *</Label>
                  <Input id="currentArea" name="currentArea" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentCity">City *</Label>
                  <Input id="currentCity" name="currentCity" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentDistrict">District *</Label>
                  <Input id="currentDistrict" name="currentDistrict" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentState">State *</Label>
                  <Input id="currentState" name="currentState" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentCountry">Country *</Label>
                  <Input id="currentCountry" name="currentCountry" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentPincode">Pincode *</Label>
                  <Input
                    id="currentPincode"
                    name="currentPincode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="560001"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Permanent Address */}
            <div className="border-t pt-6 md:col-span-2 lg:col-span-3">
              <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <h4 className="text-lg font-semibold">Permanent Address</h4>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="same-address"
                    checked={isSameAddress}
                    onCheckedChange={handleSameAsCurrentAddress}
                  />
                  <label
                    htmlFor="same-address"
                    className="cursor-pointer text-sm font-medium leading-none"
                  >
                    Same as Current Address
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="permanentAddress">Address Line *</Label>
                  <Input
                    id="permanentAddress"
                    name="permanentAddress"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permanentArea">Area *</Label>
                  <Input id="permanentArea" name="permanentArea" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permanentCity">City *</Label>
                  <Input id="permanentCity" name="permanentCity" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permanentDistrict">District *</Label>
                  <Input
                    id="permanentDistrict"
                    name="permanentDistrict"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permanentState">State *</Label>
                  <Input id="permanentState" name="permanentState" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permanentCountry">Country *</Label>
                  <Input
                    id="permanentCountry"
                    name="permanentCountry"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permanentPincode">Pincode *</Label>
                  <Input
                    id="permanentPincode"
                    name="permanentPincode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="560001"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Demographics & Identity */}
            <div className="space-y-2">
              <Label htmlFor="placeOfBirth">Place of Birth *</Label>
              <Input id="placeOfBirth" name="placeOfBirth" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stateOfBirth">State of Birth *</Label>
              <Input id="stateOfBirth" name="stateOfBirth" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="religion">Religion *</Label>
              <Input id="religion" name="religion" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caste">Caste *</Label>
              <Input id="caste" name="caste" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subCaste">Sub caste</Label>
              <Input id="subCaste" name="subCaste" />
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <FilePicker
                name="casteCertificate"
                label="Caste Certificate (PDF)"
                accept="application/pdf"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motherTongue">Mother Tongue *</Label>
              <Input id="motherTongue" name="motherTongue" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality *</Label>
              <Input id="nationality" name="nationality" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nri">NRI Citizen *</Label>
              <input
                type="hidden"
                name="nri"
                value={nriEnabled ? "true" : "false"}
              />
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id="nri-toggle"
                  checked={nriEnabled}
                  onCheckedChange={(checked) => setNriEnabled(Boolean(checked))}
                />
                <Label
                  htmlFor="nri-toggle"
                  className="cursor-pointer text-sm font-medium"
                >
                  Has NRI status
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disability">Disability Status *</Label>
              <input
                type="hidden"
                name="disability"
                value={disabilityEnabled ? "true" : "false"}
              />
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id="disability-toggle"
                  checked={disabilityEnabled}
                  onCheckedChange={(checked) =>
                    setDisabilityEnabled(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="disability-toggle"
                  className="cursor-pointer text-sm font-medium"
                >
                  Has disability
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disabilityType">Disability Details </Label>
              <Input
                id="disabilityType"
                name="disabilityType"
                disabled={!disabilityEnabled}
              />
            </div>
            <div className="space-y-2">
              <FilePicker
                name="disabilityCertificate"
                label="Disability Certificate"
                accept="application/pdf"
                disabled={!disabilityEnabled}
              />
            </div>

            <div className="space-y-2 md:col-span-1 lg:col-span-1">
              <Label htmlFor="economicallyBackward">
                Economically Backward Status *
              </Label>
              <input
                type="hidden"
                name="economicallyBackward"
                value={economicallyBackwardEnabled ? "true" : "false"}
              />
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id="economicallyBackward-toggle"
                  checked={economicallyBackwardEnabled}
                  onCheckedChange={(checked) =>
                    setEconomicallyBackwardEnabled(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="economicallyBackward-toggle"
                  className="cursor-pointer text-sm font-medium"
                >
                  Economically backward
                </Label>
              </div>
            </div>
            <div className="space-y-2 md:col-span-1 lg:col-span-2">
              <FilePicker
                name="economicallyBackwardCertificate"
                label="Economically Backward Status Certificate"
                accept="application/pdf"
                disabled={!economicallyBackwardEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aadharNumber">Aadhar Number *</Label>
              <Input
                id="aadharNumber"
                name="aadharNumber"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{12}"
                maxLength={12}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-1 lg:col-span-2">
              <FilePicker
                name="aadharCard"
                label="Aadhar Card Proof"
                accept="application/pdf"
                required
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("personal")}
            >
              Back
            </Button>
            <Button type="button" onClick={() => saveAndNext("personal")}>
              Save and Continue
            </Button>
          </div>
        </div>

        {/* EDUCATION DETAILS */}
        <div
          ref={(node) => {
            sectionRefs.current.education = node;
          }}
          className={
            activeStep === "education" ? "space-y-6" : "hidden space-y-6"
          }
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              3. Education Details
            </h3>
          </div>

          {/* Class 10 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <h4 className="text-lg font-semibold md:col-span-2 lg:col-span-3">
              Class X Details
            </h4>

            <div className="space-y-2 md:col-span-2 lg:col-span-2">
              <Label htmlFor="class10thSchoolName">School Name *</Label>
              <Input
                id="class10thSchoolName"
                name="class10thSchoolName"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thSchoolType">School Type *</Label>
              <Select name="class10thSchoolType" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "CBSE",
                    "ICSE",
                    "State Boards",
                    "IB/IGCSE",
                    "NIOS",
                    "Other",
                  ].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class10thSchoolCity">School City *</Label>
              <Input
                id="class10thSchoolCity"
                name="class10thSchoolCity"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thSchoolState">School State *</Label>
              <Input
                id="class10thSchoolState"
                name="class10thSchoolState"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thSchoolCode">School Code *</Label>
              <Input
                id="class10thSchoolCode"
                name="class10thSchoolCode"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class10thYearOfPassing">Year of Passing *</Label>
              <Input
                id="class10thYearOfPassing"
                name="class10thYearOfPassing"
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thAggregateScore">
                Total Marks Obtained *
              </Label>
              <Input
                id="class10thAggregateScore"
                name="class10thAggregateScore"
                type="number"
                step="1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thAggregateTotal">Total Marks *</Label>
              <Input
                id="class10thAggregateTotal"
                name="class10thAggregateTotal"
                type="number"
                step="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class10thMediumOfTeaching">
                Medium of Instruction *
              </Label>
              <Input
                id="class10thMediumOfTeaching"
                name="class10thMediumOfTeaching"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-1 lg:col-span-2">
              <FilePicker
                name="class10thMarksPdf"
                label="10th Marks Card (PDF)"
                accept="application/pdf"
                required
              />
            </div>

            <div className="space-y-3 border-t pt-6 md:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Checkbox
                    id="class12-toggle"
                    checked={class12Enabled}
                    onCheckedChange={(checked) =>
                      setClass12Enabled(Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="class12-toggle"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Class 12 / PUC
                  </Label>
                </div>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Checkbox
                    id="diploma-toggle"
                    checked={diplomaEnabled}
                    onCheckedChange={(checked) =>
                      setDiplomaEnabled(Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="diploma-toggle"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Diploma
                  </Label>
                </div>
              </div>
              <input
                type="hidden"
                name="hasClass12"
                value={class12Enabled ? "true" : "false"}
              />
              <input
                type="hidden"
                name="hasDiploma"
                value={diplomaEnabled ? "true" : "false"}
              />
              <p className="text-muted-foreground text-sm">
                Choose at least one. You may complete both if applicable.
              </p>
            </div>

            <fieldset className="contents" disabled={!class12Enabled}>
              <h4 className="mt-6 border-t pt-6 text-lg font-semibold md:col-span-2 lg:col-span-3">
                Class XII / PUC Details
              </h4>

              <div className="space-y-2 md:col-span-2 lg:col-span-2">
                <Label htmlFor="class12thInstituteName">Institute Name *</Label>
                <Input
                  id="class12thInstituteName"
                  name="class12thInstituteName"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thInstituteType">Institute Type *</Label>
                <Select name="class12thInstituteType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "CBSE",
                      "CISCE/ISC",
                      "State Boards",
                      "IB",
                      "NIOS",
                      "CAIE",
                      "IBOSE",
                      "Other",
                    ].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class12thInstituteCity">Institute City *</Label>
                <Input
                  id="class12thInstituteCity"
                  name="class12thInstituteCity"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thInstituteState">
                  Institute State *
                </Label>
                <Input
                  id="class12thInstituteState"
                  name="class12thInstituteState"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thInstituteCode">Institute Code *</Label>
                <Input
                  id="class12thInstituteCode"
                  name="class12thInstituteCode"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class12thYearOfPassing">
                  Year of passing *
                </Label>
                <Input
                  id="class12thYearOfPassing"
                  name="class12thYearOfPassing"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thBranch">Branch *</Label>
                <Input
                  id="class12thBranch"
                  name="class12thBranch"
                  placeholder="PCM"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thMediumOfTeaching">
                  Medium of Instruction *
                </Label>
                <Input
                  id="class12thMediumOfTeaching"
                  name="class12thMediumOfTeaching"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class12thAggregateScore">
                  Total Marks Obtained *
                </Label>
                <Input
                  id="class12thAggregateScore"
                  name="class12thAggregateScore"
                  type="number"
                  step="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thAggregateTotal">Total Marks *</Label>
                <Input
                  id="class12thAggregateTotal"
                  name="class12thAggregateTotal"
                  type="number"
                  step="1"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <FilePicker
                  name="class12thMarksPdf"
                  label="12th Marks Card (PDF)"
                  accept="application/pdf"
                  disabled={!class12Enabled}
                  required={class12Enabled}
                />
              </div>
            </fieldset>

            <fieldset className="contents" disabled={!diplomaEnabled}>
              <h4 className="mt-6 border-t pt-6 text-lg font-semibold md:col-span-2 lg:col-span-3">
                Diploma Details
              </h4>
              <div className="space-y-2 md:col-span-2 lg:col-span-2">
                <Label htmlFor="diplomaInstituteName">Institute Name *</Label>
                <Input
                  id="diplomaInstituteName"
                  name="diplomaInstituteName"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteType">Institute Type *</Label>
                <Select name="diplomaInstituteType" required={diplomaEnabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {["DTE", "State Board", "Autonomous", "Other"].map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteCity">Institute City *</Label>
                <Input
                  id="diplomaInstituteCity"
                  name="diplomaInstituteCity"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteState">Institute State *</Label>
                <Input
                  id="diplomaInstituteState"
                  name="diplomaInstituteState"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteCode">Institute Code *</Label>
                <Input
                  id="diplomaInstituteCode"
                  name="diplomaInstituteCode"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaBranch">Branch *</Label>
                <Input
                  id="diplomaBranch"
                  name="diplomaBranch"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaYearOfPassing">Year of Passing *</Label>
                <Input
                  id="diplomaYearOfPassing"
                  name="diplomaYearOfPassing"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaMediumOfTeaching">
                  Medium of Instruction *
                </Label>
                <Input
                  id="diplomaMediumOfTeaching"
                  name="diplomaMediumOfTeaching"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaAggregateScore">
                  Total Marks Obtained *
                </Label>
                <Input
                  id="diplomaAggregateScore"
                  name="diplomaAggregateScore"
                  type="number"
                  step="1"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaAggregateTotal">Total Marks *</Label>
                <Input
                  id="diplomaAggregateTotal"
                  name="diplomaAggregateTotal"
                  type="number"
                  step="1"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <FilePicker
                  name="diplomaMarksPdf"
                  label="Diploma Marks Card (PDF)"
                  accept="application/pdf"
                  required={diplomaEnabled}
                />
              </div>
            </fieldset>

            {/* Additional Documents */}
            <h4 className="mt-6 border-t pt-6 text-lg font-semibold md:col-span-2 lg:col-span-3">
              Additional Documents
            </h4>
            <div className="space-y-2 md:col-span-1 lg:col-span-1">
              <FilePicker
                name="studyCertificate"
                label="Study Certificate (PDF)"
                accept="application/pdf"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-1 lg:col-span-1">
              <FilePicker
                name="transferCertificate"
                label="Transfer Certificate (PDF)"
                accept="application/pdf"
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("education")}
            >
              Back
            </Button>
            <Button type="button" onClick={() => saveAndNext("education")}>
              Save and Continue
            </Button>
          </div>
        </div>

        {/* PARENT DETAILS */}
        <div
          ref={(node) => {
            sectionRefs.current.parent = node;
          }}
          className={activeStep === "parent" ? "space-y-6" : "hidden space-y-6"}
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              4. Parent / Guardian Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Father */}
            <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
              <h4 className="text-lg font-semibold">Father's Details</h4>
              <div className="space-y-2">
                <Label htmlFor="fatherName">Name *</Label>
                <Input id="fatherName" name="fatherName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatherEmail">Email Address *</Label>
                <Input
                  id="fatherEmail"
                  name="fatherEmail"
                  type="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatherNumber">Phone Number *</Label>
                <Input
                  id="fatherNumber"
                  name="fatherNumber"
                  type="tel"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatherOccupation">Occupation </Label>
                <Input id="fatherOccupation" name="fatherOccupation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatherPermanentAddress">Address *</Label>
                <Input
                  id="fatherPermanentAddress"
                  name="fatherPermanentAddress"
                  required
                />
              </div>
            </div>

            {/* Mother */}
            <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
              <h4 className="text-lg font-semibold">Mother's Details</h4>
              <div className="space-y-2">
                <Label htmlFor="motherName">Name *</Label>
                <Input id="motherName" name="motherName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherEmail">Email Address *</Label>
                <Input
                  id="motherEmail"
                  name="motherEmail"
                  type="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherNumber">Phone Number *</Label>
                <Input
                  id="motherNumber"
                  name="motherNumber"
                  type="tel"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherOccupation">Occupation </Label>
                <Input id="motherOccupation" name="motherOccupation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherPermanentAddress">Address *</Label>
                <Input
                  id="motherPermanentAddress"
                  name="motherPermanentAddress"
                  required
                />
              </div>
            </div>

            {/* Guardian */}
            <div className="bg-muted/30 space-y-4 rounded-lg border p-4 md:col-span-2">
              <h4 className="text-lg font-semibold">
                Guardian's Details{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  (Optional)
                </span>
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="guardianName">Name</Label>
                  <Input id="guardianName" name="guardianName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianEmail">Email Address</Label>
                  <Input id="guardianEmail" name="guardianEmail" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianNumber">Phone Number</Label>
                  <Input id="guardianNumber" name="guardianNumber" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianOccupation">Occupation</Label>
                  <Input id="guardianOccupation" name="guardianOccupation" />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-2">
                  <Label htmlFor="guardianPermanentAddress">Address</Label>
                  <Input
                    id="guardianPermanentAddress"
                    name="guardianPermanentAddress"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("parent")}
            >
              Back
            </Button>
            <Button type="button" onClick={handleReviewStep}>
              Review Application
            </Button>
          </div>
        </div>

        {/* REVIEW */}
        <div
          ref={(node) => {
            sectionRefs.current.review = node;
          }}
          className={activeStep === "review" ? "space-y-6" : "hidden space-y-6"}
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              5. Review Application
            </h3>
          </div>

          <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">
              Review the details you entered in each section before submitting
              your application. You can go back to any section using the tabs
              above.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="bg-background rounded-md border p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Application
                </p>
                <p className="font-medium">{admission.applicationId}</p>
                <p className="text-muted-foreground text-sm">
                  {admission.modeOfAdmission}
                </p>
              </div>
              <div className="bg-background rounded-md border p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Selected files
                </p>
                <p className="text-muted-foreground text-sm">
                  Photo, mark sheets, and certificates added in earlier steps
                  will be attached when you submit.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("review")}
            >
              Back
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full px-8 md:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Uploading Documents..." : "Submit Application"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
