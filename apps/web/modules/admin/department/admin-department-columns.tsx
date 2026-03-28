"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DepartmentResponseDTO } from "@webcampus/schemas/department";
import { AdminDepartmentActions } from "./admin-department-actions";

export type DepartmentTableItem = DepartmentResponseDTO & {
  email?: string;
  emailVerified?: boolean;
  username?: string | null;
  displayUsername?: string | null;
};

export const adminDepartmentColumns: ColumnDef<DepartmentTableItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "code",
    header: "Department Code",
  },
  {
    accessorKey: "abbreviation",
    header: "Abbreviation",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "username",
    header: "Username",
  },
  {
    accessorKey: "displayUsername",
    header: "Display Username",
  },
  {
    accessorKey: "emailVerified",
    header: "Email Verified",
    meta: {
      enableCopy: false,
    },
  },
  {
    id: "actions",
    meta: {
      enableCopy: false,
    },
    cell: ({ row }) => {
      const department = row.original;
      return <AdminDepartmentActions department={department} />;
    },
  },
];
