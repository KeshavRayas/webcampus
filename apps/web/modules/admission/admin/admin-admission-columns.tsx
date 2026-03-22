"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import dayjs from "dayjs";
import { AdminAdmissionActions } from "./admin-admission-actions";

export type AdmissionResponse = {
  id: string;
  applicationId: string;
  modeOfAdmission: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
  createdAt: string;

  departmentId?: string | null;

  // Added all the fields from the database
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  branch?: string | null;
  categoryClaimed?: string | null;
  categoryAllotted?: string | null;
  quota?: string | null;
  entranceExamRank?: string | null;
  originalAdmissionOrderNumber?: string | null;
  originalAdmissionOrderDate?: Date | null;
  feePayable?: number | null;
  feePaid?: number | null;
  hostel?: boolean | null;
  hostelRoomNumber?: string | null;

  nameAsPer10th?: string | null;
  dob?: Date | null;
  bloodGroup?: string | null;
  gender?: string | null;
  photo?: string | null;
  primaryPhoneNumber?: string | null;
  secondaryPhoneNumber?: string | null;
  emergencyContactNumber?: string | null;
  primaryEmail?: string | null;
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

  class10thSchoolName?: string | null;
  class10thSchoolType?: string | null;
  class10thSchoolCity?: string | null;
  class10thSchoolState?: string | null;
  class10thSchoolCode?: string | null;
  class10thYearOfPassing?: string | null;
  class10thAggregateScore?: number | null;
  class10thAggregateTotal?: number | null;
  class10thMediumOfTeaching?: string | null;
  class10thMarksPdf?: string | null;

  class12thInstituteName?: string | null;
  class12thInstituteType?: string | null;
  class12thInstituteCity?: string | null;
  class12thInstituteState?: string | null;
  class12thInstituteCode?: string | null;
  class12thYearOfPassing?: string | null;
  class12thBranch?: string | null;
  class12thAggregateScore?: number | null;
  class12thAggregateTotal?: number | null;
  class12thMediumOfTeaching: string | null;
  class12thMarksPdf?: string | null;

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
  usn?: string | null;
  uniqueId?: string | null;
};

const baseColumns: ColumnDef<AdmissionResponse>[] = [
  {
    accessorKey: "applicationId",
    header: "Application ID",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.applicationId}</div>
    ),
  },
  {
    accessorKey: "modeOfAdmission",
    header: "Mode",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const variant =
        status === "APPROVED"
          ? "default"
          : status === "SUBMITTED"
            ? "secondary"
            : status === "REJECTED"
              ? "destructive"
              : "outline";

      return <Badge variant={variant}>{status}</Badge>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created On",
    cell: ({ row }) => (
      <div>{dayjs(row.original.createdAt).format("MMM D, YYYY")}</div>
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
          id: "actions",
          header: "Actions",
          cell: ({ row }: { row: { original: AdmissionResponse } }) => (
            <AdminAdmissionActions admission={row.original} />
          ),
        } satisfies ColumnDef<AdmissionResponse>,
      ]
    : []),
  {
    id: "menu",
    header: "",
    cell: ({ row }) => (
      <AdminAdmissionActions admission={row.original} menuOnly />
    ),
  },
];
