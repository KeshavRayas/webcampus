"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { getAdmissionFullName } from "../admin/admin-admission-columns";
import { UploadDocsActions } from "./upload-docs-actions";

export type UploadDocsResponse = {
  id: string;
  applicationId: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXITED";

  primaryEmail: string;

  nameAsPer10th?: string | null;

  student?: {
    usn: string;
    user: {
      name: string;
    };
  } | null;

  filledBy: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  };

  photo?: string | null;
  aadharCard?: string | null;

  class10thMarksPdf?: string | null;
  class12thMarksPdf?: string | null;
  diplomaMarksPdf?: string | null;

  casteCertificate?: string | null;
  disability?: boolean | null;
  disabilityCertificate?: string | null;

  studyCertificate?: string | null;
  transferCertificate?: string | null;
  embassyPermissionLetter?: string | null;
};

const countDocuments = (row: UploadDocsResponse) => {
  const docs = [
    row.photo,
    row.aadharCard,
    row.class10thMarksPdf,
    row.class12thMarksPdf,
    row.diplomaMarksPdf,
    row.casteCertificate,
    row.studyCertificate,
    row.transferCertificate,
    ...(row.disability ? [row.disabilityCertificate] : []),
  ];

  return docs.filter((doc): doc is string => !!doc).length;
};

const totalDocuments = (row: UploadDocsResponse) => (row.disability ? 9 : 8);

export const uploadDocsColumns: ColumnDef<UploadDocsResponse>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{getAdmissionFullName(row.original)}</div>
    ),
  },

  {
    accessorKey: "primaryEmail",
    header: "College Email",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.primaryEmail}</div>
    ),
  },

  {
    accessorKey: "primaryEmail",
    header: "College Email",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.primaryEmail}</div>
    ),
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
    id: "documents",
    header: "Documents",
    cell: ({ row }) => {
      const uploaded = countDocuments(row.original);
      const total = totalDocuments(row.original);

      return (
        <div className="font-medium">
          {uploaded} / {total}
        </div>
      );
    },
  },

  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <UploadDocsActions admission={row.original} />,
  },
];
