"use client";

import { Button } from "@webcampus/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@webcampus/ui/components/sheet";
import { Eye } from "lucide-react";
import React from "react";
import { AdmissionResponse } from "./admin-admission-columns";

export const AdminAdmissionActions = ({
  admission,
}: {
  admission: AdmissionResponse;
}) => {
  const isPending = admission.status === "PENDING";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Admission Details</SheetTitle>
          <SheetDescription>
            Application ID: {admission.applicationId}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isPending ? (
            <div className="bg-secondary/20 rounded border p-4 text-center">
              <p className="text-muted-foreground text-sm">
                This applicant has not yet submitted their details.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Personal Details */}
              <div className="space-y-2">
                <h4 className="border-b pb-2 font-semibold">
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Name:</div>
                  <div className="font-medium">{admission.name}</div>
                  <div className="text-muted-foreground">Email:</div>
                  <div className="font-medium">{admission.email}</div>
                  <div className="text-muted-foreground">Phone:</div>
                  <div className="font-medium">{admission.phoneNumber}</div>
                  <div className="text-muted-foreground">Gender:</div>
                  <div className="font-medium">{admission.gender}</div>
                  <div className="text-muted-foreground col-span-2 mt-2">
                    Address:
                  </div>
                  <div className="bg-secondary/10 col-span-2 rounded p-3 font-medium">
                    {admission.address}
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div className="space-y-2">
                <h4 className="border-b pb-2 font-semibold">
                  Academic Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">10th Marks:</div>
                  <div className="font-medium">{admission.class10thMarks}%</div>
                  <div className="text-muted-foreground">10th School:</div>
                  <div className="font-medium">
                    {admission.class10thSchoolName}
                  </div>
                  <div className="text-muted-foreground">12th Marks:</div>
                  <div className="font-medium">{admission.class12thMarks}%</div>
                  <div className="text-muted-foreground">12th School:</div>
                  <div className="font-medium">
                    {admission.class12thSchoolName}
                  </div>
                </div>
              </div>

              {/* Parent Details */}
              <div className="space-y-2">
                <h4 className="border-b pb-2 font-semibold">
                  Parent Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Father's Name:</div>
                  <div className="font-medium">{admission.fatherName}</div>
                  <div className="text-muted-foreground">Mother's Name:</div>
                  <div className="font-medium">{admission.motherName}</div>
                  <div className="text-muted-foreground">Father's Phone:</div>
                  <div className="font-medium">{admission.fatherNumber}</div>
                </div>
              </div>

              {/* Document Uploads */}
              <div className="space-y-2">
                <h4 className="border-b pb-2 font-semibold">
                  Documents (S3 Links)
                </h4>
                <div className="flex flex-col gap-3">
                  {admission.photo && (
                    <a
                      href={admission.photo}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-500 hover:underline"
                    >
                      ↗ View Passport Photo
                    </a>
                  )}
                  {admission.class10thMarksPdf && (
                    <a
                      href={admission.class10thMarksPdf}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-500 hover:underline"
                    >
                      ↗ View 10th Marks Card (PDF)
                    </a>
                  )}
                  {admission.class12thMarksPdf && (
                    <a
                      href={admission.class12thMarksPdf}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-500 hover:underline"
                    >
                      ↗ View 12th Marks Card (PDF)
                    </a>
                  )}
                  {admission.casteCertificate && (
                    <a
                      href={admission.casteCertificate}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-500 hover:underline"
                    >
                      ↗ View Caste Certificate (PDF)
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
