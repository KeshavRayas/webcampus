"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import axios, { isAxiosError } from "axios";
import React, { useState } from "react";
import { toast } from "react-toastify";

type ApplicantAdmissionData = {
  applicationId: string;
  modeOfAdmission: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
};

export const ApplicantAdmissionView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);

    // We must use FormData because we are sending files alongside text!
    const formData = new FormData(e.currentTarget);

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

  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-medium">Complete Your Application</h3>
        <p className="text-muted-foreground text-sm">
          Application ID:{" "}
          <span className="font-bold">{admission.applicationId}</span> | Mode:{" "}
          <span className="font-bold">{admission.modeOfAdmission}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" name="name" required placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input id="phoneNumber" name="phoneNumber" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender *</Label>
            <Input id="gender" name="gender" required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Full Address *</Label>
            <Input id="address" name="address" required />
          </div>
        </div>

        {/* Academic Details */}
        <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="class10thMarks">10th Grade Marks (%) *</Label>
            <Input
              id="class10thMarks"
              name="class10thMarks"
              type="number"
              step="0.01"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class10thSchoolName">10th School Name *</Label>
            <Input
              id="class10thSchoolName"
              name="class10thSchoolName"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class12thMarks">12th Grade Marks (%) *</Label>
            <Input
              id="class12thMarks"
              name="class12thMarks"
              type="number"
              step="0.01"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class12thSchoolName">
              12th School/College Name *
            </Label>
            <Input
              id="class12thSchoolName"
              name="class12thSchoolName"
              required
            />
          </div>
        </div>

        {/* Document Uploads */}
        <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="photo">Passport Size Photo (Image) *</Label>
            <Input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="casteCertificate">Caste Certificate (PDF)</Label>
            <Input
              id="casteCertificate"
              name="casteCertificate"
              type="file"
              accept="application/pdf"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class10thMarksPdf">10th Marks Card (PDF) *</Label>
            <Input
              id="class10thMarksPdf"
              name="class10thMarksPdf"
              type="file"
              accept="application/pdf"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class12thMarksPdf">12th Marks Card (PDF) *</Label>
            <Input
              id="class12thMarksPdf"
              name="class12thMarksPdf"
              type="file"
              accept="application/pdf"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Uploading Documents..." : "Submit Application"}
        </Button>
      </form>
    </div>
  );
};
