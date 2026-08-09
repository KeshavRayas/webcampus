"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AdminAdmissionActions } from "./admin-admission-actions";

export type AdmissionResponse = {
  id: string;
  applicationId: string;
  modeOfAdmission: string;
  semesterId?: string | null;
  status:
    | "PENDING"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "EXITED"
    | "CANCELLED";
  createdAt: string;

  departmentId?: string | null;
  department?: { name: string } | null;
  student?: {
    usn: string;
    user: {
      name: string;
    };
  } | null;
  archive?: {
    reason: string;
    cancelledAt: string;
  } | null;
  filledBy: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  };

  // Added all the fields from the database
  categoryClaimed?: string | null;
  categoryAllotted?: string | null;
  quota?: string | null;
  entranceExamRank?: string | null;
  originalAdmissionOrderNumber?: string | null;
  originalAdmissionOrderDate?: Date | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  feePaid?: number | null;
  feeReceiptNumber?: string | null;
  hostel?: boolean | null;
  scholarship?: boolean | null;
  abcAparId?: string | null;
  sspId?: string | null;
  counsellingRound?: string | null;
  admissionType?: string | null;

  nameAsPer10th?: string | null;
  dob?: Date | null;
  bloodGroup?: string | null;
  gender?: string | null;
  photo?: string | null;
  primaryPhoneNumber?: string | null;
  secondaryPhoneNumber?: string | null;
  emergencyContactNumber?: string | null;
  primaryEmail: string;
  secondaryEmail?: string | null;

  currentAddress?: string | null;
  currentArea?: string | null;
  currentCity?: string | null;
  currentDistrict?: string | null;
  currentState?: string | null;
  currentCountry?: string | null;
  currentPincode?: string | null;

  permanentAddress?: string | null;
  permanentArea?: string | null;
  permanentCity?: string | null;
  permanentDistrict?: string | null;
  permanentState?: string | null;
  permanentCountry?: string | null;
  permanentPincode?: string | null;

  placeOfBirth?: string | null;
  stateOfBirth?: string | null;
  religion?: string | null;
  caste?: string | null;
  subCaste?: string | null;
  casteCertificate?: string | null;
  motherTongue?: string | null;
  nri?: boolean | null;
  nationality?: string | null;

  disability?: boolean | null;
  disabilityType?: string | null;
  disabilityCertificate?: string | null;

  economicallyBackward?: boolean | null;
  economicallyBackwardCertificate?: string | null;

  aadharNumber?: string | null;
  aadharCard?: string | null;

  passportNumber?: string | null;
  passportExpiryDate?: string | null;
  visaNumber?: string | null;
  visaExpiryDate?: string | null;
  parentPassportNumber?: string | null;
  parentVisaNumber?: string | null;
  parentVisaExpiryDate?: string | null;
  studiedKannadaIn10th?: boolean | null;

  class10thSchoolName?: string | null;
  class10thRollRegNumber?: string | null;
  class10thSchoolType?: string | null;
  class10thSchoolCity?: string | null;
  class10thSchoolState?: string | null;
  class10thYearOfPassing?: string | null;
  class10thAggregateScore?: number | null;
  class10thAggregateTotal?: number | null;
  class10thMediumOfTeaching?: string | null;
  class10thMarksPdf?: string | null;

  class12thInstituteName?: string | null;
  class12thRollRegNumber?: string | null;
  class12thInstituteType?: string | null;
  class12thInstituteCity?: string | null;
  class12thInstituteState?: string | null;
  class12thYearOfPassing?: string | null;
  class12thBranch?: string | null;
  class12thAggregateScore?: number | null;
  class12thAggregateTotal?: number | null;
  class12thMediumOfTeaching: string | null;
  class12thMarksPdf?: string | null;
  admissionBasedOn?: string | null;
  physicsMarks?: number | null;
  physicsMaxMarks?: number | null;
  physicsMinMarks?: number | null;
  physicsPercentage?: number | null;
  chemistryMarks?: number | null;
  chemistryMaxMarks?: number | null;
  chemistryMinMarks?: number | null;
  chemistryPercentage?: number | null;
  mathematicsMarks?: number | null;
  mathematicsMaxMarks?: number | null;
  mathematicsMinMarks?: number | null;
  mathematicsPercentage?: number | null;
  pcmPercentage?: number | null;

  diplomaInstituteName?: string | null;
  diplomaInstituteType?: string | null;
  diplomaInstituteCity?: string | null;
  diplomaInstituteState?: string | null;
  diplomaBranch?: string | null;
  diplomaYearOfPassing?: string | null;
  diplomaMediumOfTeaching?: string | null;
  diplomaAggregateScore?: number | null;
  diplomaAggregateTotal?: number | null;

  studyCertificate?: string | null;
  transferCertificate?: string | null;

  fatherName?: string | null;
  fatherEmail?: string | null;
  fatherNumber?: string | null;
  fatherPermanentAddress?: string | null;
  fatherOccupation?: string | null;

  motherName?: string | null;
  motherEmail?: string | null;
  motherNumber?: string | null;
  motherPermanentAddress?: string | null;
  motherOccupation?: string | null;

  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianNumber?: string | null;
  guardianPermanentAddress?: string | null;
  guardianOccupation?: string | null;

  tempUsn?: string | null;
  uniqueId?: string | null;
};

const baseColumns: ColumnDef<AdmissionResponse>[] = [
  {
    accessorKey: "primaryEmail",
    header: "College Email",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.primaryEmail}</div>
    ),
  },
  {
    id: "createdAt",
    header: "Created On",
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      if (!createdAt) return <div>-</div>;
      const date = new Date(createdAt);
      return (
        <div suppressHydrationWarning>
          {Number.isNaN(date.getTime())
            ? "-"
            : date.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
        </div>
      );
    },
  },
  {
    id: "filledBy",
    header: "Filled By",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.filledBy.name}</div>
        <div className="text-muted-foreground text-xs">
          {row.original.filledBy.role ?? row.original.filledBy.email}
        </div>
      </div>
    ),
  },
];

export const getAdminAdmissionColumns = (
  showViewDetails: boolean
): ColumnDef<AdmissionResponse>[] => [
  ...baseColumns,
  ...(showViewDetails
    ? [
        {
          id: "name",
          header: "Name",
          cell: ({ row }: { row: { original: AdmissionResponse } }) => {
            const studentName = row.original.student?.user?.name?.trim();
            const admissionName = row.original.nameAsPer10th?.trim();

            return <div>{studentName || admissionName || "-"}</div>;
          },
        },
        {
          id: "actions",
          header: "Actions",
          cell: ({ row }: { row: { original: AdmissionResponse } }) => (
            <AdminAdmissionActions admission={row.original} />
          ),
        } satisfies ColumnDef<AdmissionResponse>,
      ]
    : []),
];
