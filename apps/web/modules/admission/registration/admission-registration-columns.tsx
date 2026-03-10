"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AdmissionRegistrationActions } from "./admission-registration-actions";

export type AdmissionRecord = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  class10thMarks: number | null;
  class12thMarks: number | null;
  modeOfAdmission: string | null;
  photo: string | null;
};

export const admissionRegistrationColumns: ColumnDef<AdmissionRecord>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "phoneNumber",
    header: "Phone",
  },
  {
    accessorKey: "address",
    header: "Address",
  },
  {
    accessorKey: "class10thMarks",
    header: "10th Marks",
  },
  {
    accessorKey: "class12thMarks",
    header: "12th Marks",
  },
  {
    accessorKey: "modeOfAdmission",
    header: "Admission Mode",
  },
  {
    accessorKey: "photo",
    header: "Photo",
    meta: {
      enableCopy: false,
    },
    cell: ({ row }) => {
      const photo = row.original.photo;
      if (!photo) return null;
      return (
        <img
          src={photo}
          alt={row.original.name}
          className="h-12 w-12 rounded-full object-cover"
        />
      );
    },
  },
  {
    id: "actions",
    meta: {
      enableCopy: false,
    },
    cell: ({ row }) => {
      const { id } = row.original;
      return <AdmissionRegistrationActions id={id} />;
    },
  },
];
