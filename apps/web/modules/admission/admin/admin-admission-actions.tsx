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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import { Eye, MoreHorizontal } from "lucide-react";
import React, { useState } from "react";
import { AdmissionResponse } from "./admin-admission-columns";
import { useAdmissionDelete } from "./use-admission-delete";

const getStatusVariant = (status: AdmissionResponse["status"]) => {
  if (status === "APPROVED") return "default" as const;
  if (status === "SUBMITTED") return "secondary" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "outline" as const;
};

const getInitials = (name?: string | null) => {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "NA";
  if (parts.length === 1) return (parts[0] ?? "NA").slice(0, 2).toUpperCase();
  const firstInitial = parts[0]?.[0] ?? "N";
  const secondInitial = parts[1]?.[0] ?? "A";
  return `${firstInitial}${secondInitial}`.toUpperCase();
};

const DataField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | boolean | Date | null;
}) => {
  let displayValue = "-";
  if (value !== undefined && value !== null && value !== "") {
    if (typeof value === "boolean") {
      displayValue = value ? "Yes" : "No";
    } else if (value instanceof Date) {
      displayValue = value.toLocaleDateString();
    } else if (
      typeof value === "string" &&
      !isNaN(Date.parse(value)) &&
      value.includes("T")
    ) {
      displayValue = new Date(value).toLocaleDateString();
    } else {
      displayValue = String(value);
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-medium break-words">{displayValue}</p>
    </div>
  );
};

export const AdminAdmissionActions = ({
  admission,
  menuOnly = false,
}: {
  admission: AdmissionResponse;
  menuOnly?: boolean;
}) => {
  const isPending = admission.status === "PENDING";
  const { onDelete } = useAdmissionDelete();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Compute Full Name
  const fullName = [
    admission.firstName,
    admission.middleName,
    admission.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  // Format Address block
  const currentFullAddress = [
    admission.currentAddress,
    admission.currentArea,
    admission.currentCity,
    admission.currentDistrict,
    admission.currentState,
    admission.currentCountry,
    admission.currentPincode,
  ]
    .filter(Boolean)
    .join(", ");
  const permanentFullAddress = [
    admission.permanentAddress,
    admission.permanentArea,
    admission.permanentCity,
    admission.permanentDistrict,
    admission.permanentState,
    admission.permanentCountry,
    admission.permanentPincode,
  ]
    .filter(Boolean)
    .join(", ");

  if (menuOnly) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="text-red-600 focus:text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Admission</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this admission? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(admission.id);
                  setIsDeleteOpen(false);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* View Details Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] w-full overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="px-8 pt-8">
            <DialogTitle className="text-left text-2xl">
              Admission Details
            </DialogTitle>
            <DialogDescription>
              Application ID: {admission.applicationId}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-8 pb-8">
            <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_1fr]">
              <div className="bg-card flex w-full flex-col items-center gap-4 rounded-xl border p-6 lg:w-72">
                <Avatar className="h-28 w-28 border">
                  <AvatarImage
                    src={admission.photo || undefined}
                    alt={fullName || "Student photo"}
                  />
                  <AvatarFallback className="text-xl font-semibold">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="w-full space-y-3 text-center">
                  <p className="text-lg font-semibold">{fullName || "-"}</p>
                  <p className="text-muted-foreground text-sm break-all">
                    {admission.primaryEmail || "-"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {admission.primaryPhoneNumber || "-"}
                  </p>
                </div>

                <div className="w-full space-y-3 border-t pt-4">
                  <DataField
                    label="Admission Mode"
                    value={admission.modeOfAdmission}
                  />
                  <DataField
                    label="Application ID"
                    value={admission.applicationId}
                  />
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Status</p>
                    <Badge variant={getStatusVariant(admission.status)}>
                      {admission.status}
                    </Badge>
                  </div>
                  <DataField label="Temporary USN" value={admission.tempUsn} />
                  <DataField label="USN" value={admission.usn} />
                  <DataField label="Unique ID" value={admission.uniqueId} />
                </div>
              </div>

              <div>
                {isPending ? (
                  <div className="bg-secondary/20 rounded-xl border p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      This applicant has not yet submitted their details.
                    </p>
                  </div>
                ) : (
                  <>
                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 text-lg font-semibold">
                        Admission Details
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField label="Branch" value={admission.branch} />
                        <DataField label="Quota" value={admission.quota} />
                        <DataField
                          label="Entrance Exam Rank"
                          value={admission.entranceExamRank}
                        />
                        <DataField
                          label="Category Claimed"
                          value={admission.categoryClaimed}
                        />
                        <DataField
                          label="Category Allotted"
                          value={admission.categoryAllotted}
                        />
                        <DataField
                          label="Admission Order No."
                          value={admission.originalAdmissionOrderNumber}
                        />
                        <DataField
                          label="Admission Order Date"
                          value={admission.originalAdmissionOrderDate}
                        />
                        <DataField
                          label="Fee Payable"
                          value={
                            admission.feePayable
                              ? `₹${admission.feePayable}`
                              : null
                          }
                        />
                        <DataField
                          label="Fee Paid"
                          value={
                            admission.feePaid ? `₹${admission.feePaid}` : null
                          }
                        />
                        <DataField
                          label="Hostel Required"
                          value={admission.hostel}
                        />
                        <DataField
                          label="Hostel Room No."
                          value={admission.hostelRoomNumber}
                        />
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Personal Information
                      </h4>
                      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField label="Name" value={fullName} />
                        <DataField
                          label="Name as per 10th"
                          value={admission.nameAsPer10th}
                        />
                        <DataField
                          label="Date of Birth"
                          value={admission.dob}
                        />
                        <DataField label="Gender" value={admission.gender} />
                        <DataField
                          label="Blood Group"
                          value={admission.bloodGroup}
                        />
                        <DataField
                          label="Nationality"
                          value={admission.nationality}
                        />
                        <DataField
                          label="Mother Tongue"
                          value={admission.motherTongue}
                        />
                        <DataField
                          label="Religion"
                          value={admission.religion}
                        />
                        <DataField label="Caste" value={admission.caste} />
                        <DataField
                          label="Sub-Caste"
                          value={admission.subCaste}
                        />
                        <DataField
                          label="Place of Birth"
                          value={admission.placeOfBirth}
                        />
                        <DataField
                          label="State of Birth"
                          value={admission.stateOfBirth}
                        />
                        <DataField label="NRI" value={admission.nri} />
                        <DataField
                          label="Economically Backward"
                          value={admission.economicallyBackward}
                        />
                        <DataField
                          label="Disability"
                          value={admission.disability}
                        />
                        {admission.disability && (
                          <DataField
                            label="Disability Type"
                            value={admission.disabilityType}
                          />
                        )}
                        <DataField
                          label="Aadhar Number"
                          value={admission.aadharNumber}
                        />
                      </div>
                      <div className="mb-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-3">
                        <DataField
                          label="Primary Email"
                          value={admission.primaryEmail}
                        />
                        <DataField
                          label="Secondary Email"
                          value={admission.secondaryEmail}
                        />
                        <DataField
                          label="Primary Phone"
                          value={admission.primaryPhoneNumber}
                        />
                        <DataField
                          label="Secondary Phone"
                          value={admission.secondaryPhoneNumber}
                        />
                        <DataField
                          label="Emergency Contact"
                          value={admission.emergencyContactNumber}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
                        <div className="space-y-1 md:col-span-1">
                          <p className="text-muted-foreground text-sm">
                            Current Address
                          </p>
                          <p className="font-medium break-words">
                            {currentFullAddress || "-"}
                          </p>
                        </div>
                        <div className="space-y-1 md:col-span-1">
                          <p className="text-muted-foreground text-sm">
                            Permanent Address
                          </p>
                          <p className="font-medium break-words">
                            {permanentFullAddress || "-"}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Education Details
                      </h4>
                      <h5 className="text-md text-primary mb-3 font-semibold">
                        10th Grade
                      </h5>
                      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField
                          label="School Name"
                          value={admission.class10thSchoolName}
                        />
                        <DataField
                          label="School Type"
                          value={admission.class10thSchoolType}
                        />
                        <DataField
                          label="Medium of Teaching"
                          value={admission.class10thMediumOfTeaching}
                        />
                        <DataField
                          label="School City"
                          value={admission.class10thSchoolCity}
                        />
                        <DataField
                          label="School State"
                          value={admission.class10thSchoolState}
                        />
                        <DataField
                          label="Year of Passing"
                          value={admission.class10thYearOfPassing}
                        />
                        <DataField
                          label="Aggregate Score"
                          value={admission.class10thAggregateScore}
                        />
                        <DataField
                          label="Aggregate Total"
                          value={admission.class10thAggregateTotal}
                        />
                        <DataField
                          label="Percentage"
                          value={
                            admission.class10thAggregateScore &&
                            admission.class10thAggregateTotal
                              ? `${((admission.class10thAggregateScore / admission.class10thAggregateTotal) * 100).toFixed(2)}%`
                              : "-"
                          }
                        />
                      </div>

                      <h5 className="text-md text-primary mb-3 border-t pt-4 font-semibold">
                        12th Grade / PUC
                      </h5>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField
                          label="Institute Name"
                          value={admission.class12thInstituteName}
                        />
                        <DataField
                          label="Institute Type"
                          value={admission.class12thInstituteType}
                        />
                        <DataField
                          label="Branch/Stream"
                          value={admission.class12thBranch}
                        />
                        <DataField
                          label="Medium of Teaching"
                          value={admission.class12thMediumOfTeaching}
                        />
                        <DataField
                          label="Institute City"
                          value={admission.class12thInstituteCity}
                        />
                        <DataField
                          label="Institute State"
                          value={admission.class12thInstituteState}
                        />
                        <DataField
                          label="Year of Passing"
                          value={admission.class12thYearOfPassing}
                        />
                        <DataField
                          label="Aggregate Score"
                          value={admission.class12thAggregateScore}
                        />
                        <DataField
                          label="Aggregate Total"
                          value={admission.class12thAggregateTotal}
                        />
                        <DataField
                          label="Percentage"
                          value={
                            admission.class12thAggregateScore &&
                            admission.class12thAggregateTotal
                              ? `${((admission.class12thAggregateScore / admission.class12thAggregateTotal) * 100).toFixed(2)}%`
                              : "-"
                          }
                        />
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Parent / Guardian Information
                      </h4>
                      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="space-y-4">
                          <h5 className="text-md text-primary font-semibold">
                            Father's Details
                          </h5>
                          <DataField
                            label="Name"
                            value={admission.fatherName}
                          />
                          <DataField
                            label="Phone"
                            value={admission.fatherNumber}
                          />
                          <DataField
                            label="Email"
                            value={admission.fatherEmail}
                          />
                          <DataField
                            label="Occupation"
                            value={admission.fatherOccupation}
                          />
                        </div>
                        <div className="space-y-4">
                          <h5 className="text-md text-primary font-semibold">
                            Mother's Details
                          </h5>
                          <DataField
                            label="Name"
                            value={admission.motherName}
                          />
                          <DataField
                            label="Phone"
                            value={admission.motherNumber}
                          />
                          <DataField
                            label="Email"
                            value={admission.motherEmail}
                          />
                          <DataField
                            label="Occupation"
                            value={admission.motherOccupation}
                          />
                        </div>
                        <div className="space-y-4">
                          <h5 className="text-md text-primary font-semibold">
                            Guardian's Details
                          </h5>
                          <DataField
                            label="Name"
                            value={admission.guardianName}
                          />
                          <DataField
                            label="Phone"
                            value={admission.guardianNumber}
                          />
                          <DataField
                            label="Email"
                            value={admission.guardianEmail}
                          />
                          <DataField
                            label="Occupation"
                            value={admission.guardianOccupation}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Documents
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Passport Photo
                          </p>
                          {admission.photo ? (
                            <a
                              href={admission.photo}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Aadhar Card
                          </p>
                          {admission.aadharCard ? (
                            <a
                              href={admission.aadharCard}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            10th Marks Card
                          </p>
                          {admission.class10thMarksPdf ? (
                            <a
                              href={admission.class10thMarksPdf}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            12th Marks Card
                          </p>
                          {admission.class12thMarksPdf ? (
                            <a
                              href={admission.class12thMarksPdf}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Caste Certificate
                          </p>
                          {admission.casteCertificate ? (
                            <a
                              href={admission.casteCertificate}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Disability Certificate
                          </p>
                          {admission.disabilityCertificate ? (
                            <a
                              href={admission.disabilityCertificate}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            EWS Certificate
                          </p>
                          {admission.economicallyBackwardCertificate ? (
                            <a
                              href={admission.economicallyBackwardCertificate}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Transfer Certificate
                          </p>
                          {admission.transferCertificate ? (
                            <a
                              href={admission.transferCertificate}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Study Certificate
                          </p>
                          {admission.studyCertificate ? (
                            <a
                              href={admission.studyCertificate}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
