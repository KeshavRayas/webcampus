"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { AdminFacultyActions } from "./admin-faculty-actions";

export type AdminFacultyResponse = {
  id: string;
  userId: string;
  departmentId: string;
  employeeId?: string | null;
  staffType?: string | null;
  designation: string;
  dob?: string | null;
  dateOfJoining?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  qualification?: string | null;
  aboutYourself?: string | null;
  researchInterests?: string | null;
  otherInformation?: string | null;
  mobileNumber?: string | null;
  alternateContactNumber?: string | null;
  personalEmail?: string | null;
  presentAddressLine?: string | null;
  presentCity?: string | null;
  presentState?: string | null;
  presentPincode?: string | null;
  permanentAddressLine?: string | null;
  permanentCity?: string | null;
  permanentState?: string | null;
  permanentPincode?: string | null;
  department?: {
    name: string;
  };
  user: {
    name: string;
    email: string;
    username?: string | null;
    displayUsername?: string | null;
  };
  hod?: { id: string } | null;
};

const formatDesignation = (designation: string) =>
  designation
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const formatAddress = (
  line?: string | null,
  city?: string | null,
  state?: string | null,
  pincode?: string | null
) => {
  const parts = [line, city, state, pincode].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
};

export const AdminFacultyColumns: ColumnDef<AdminFacultyResponse>[] = [
  {
    accessorKey: "user.name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {row.original.user?.name}
        {row.original.hod && (
          <Badge variant="secondary" className="h-5 py-0 text-xs">
            HOD
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "employeeId",
    header: "Employee ID",
    cell: ({ row }) => <div>{row.original.employeeId || "-"}</div>,
  },
  {
    accessorKey: "staffType",
    header: "Staff Type",
    cell: ({ row }) => <div>{row.original.staffType || "-"}</div>,
  },
  {
    accessorKey: "user.email",
    header: "Official Email",
    cell: ({ row }) => <div>{row.original.user?.email}</div>,
  },
  {
    accessorKey: "user.username",
    header: "Username",
    cell: ({ row }) => <div>{row.original.user?.username || "-"}</div>,
  },
  {
    accessorKey: "user.displayUsername",
    header: "Display Username",
    cell: ({ row }) => <div>{row.original.user?.displayUsername || "-"}</div>,
  },
  {
    accessorKey: "personalEmail",
    header: "Personal Email",
    cell: ({ row }) => <div>{row.original.personalEmail || "-"}</div>,
  },
  {
    accessorKey: "mobileNumber",
    header: "Mobile",
    cell: ({ row }) => <div>{row.original.mobileNumber || "-"}</div>,
  },
  {
    accessorKey: "alternateContactNumber",
    header: "Alt Contact",
    cell: ({ row }) => <div>{row.original.alternateContactNumber || "-"}</div>,
  },
  {
    accessorKey: "designation",
    header: "Designation",
    cell: ({ row }) => <div>{formatDesignation(row.original.designation)}</div>,
  },
  {
    accessorKey: "department.name",
    header: "Department",
    cell: ({ row }) => <div>{row.original.department?.name || "-"}</div>,
  },
  {
    accessorKey: "dob",
    header: "Date of Birth",
    cell: ({ row }) => <div>{formatDate(row.original.dob)}</div>,
  },
  {
    accessorKey: "dateOfJoining",
    header: "Date of Joining",
    cell: ({ row }) => <div>{formatDate(row.original.dateOfJoining)}</div>,
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => <div>{row.original.gender || "-"}</div>,
  },
  {
    accessorKey: "bloodGroup",
    header: "Blood Group",
    cell: ({ row }) => <div>{row.original.bloodGroup || "-"}</div>,
  },
  {
    accessorKey: "maritalStatus",
    header: "Marital Status",
    cell: ({ row }) => <div>{row.original.maritalStatus || "-"}</div>,
  },
  {
    accessorKey: "nationality",
    header: "Nationality",
    cell: ({ row }) => <div>{row.original.nationality || "-"}</div>,
  },
  {
    accessorKey: "qualification",
    header: "Qualification",
    cell: ({ row }) => <div>{row.original.qualification || "-"}</div>,
  },
  {
    id: "presentAddress",
    header: "Present Address",
    cell: ({ row }) => (
      <div>
        {formatAddress(
          row.original.presentAddressLine,
          row.original.presentCity,
          row.original.presentState,
          row.original.presentPincode
        )}
      </div>
    ),
  },
  {
    id: "permanentAddress",
    header: "Permanent Address",
    cell: ({ row }) => (
      <div>
        {formatAddress(
          row.original.permanentAddressLine,
          row.original.permanentCity,
          row.original.permanentState,
          row.original.permanentPincode
        )}
      </div>
    ),
  },
  {
    accessorKey: "aboutYourself",
    header: "About Yourself",
    cell: ({ row }) => <div>{row.original.aboutYourself || "-"}</div>,
  },
  {
    accessorKey: "researchInterests",
    header: "Research Interests",
    cell: ({ row }) => <div>{row.original.researchInterests || "-"}</div>,
  },
  {
    accessorKey: "otherInformation",
    header: "Other Info",
    cell: ({ row }) => <div>{row.original.otherInformation || "-"}</div>,
  },
  {
    id: "actions",
    cell: ({ row }) => <AdminFacultyActions faculty={row.original} />,
  },
];
