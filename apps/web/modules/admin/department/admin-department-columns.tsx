"use client";

import { ColumnDef } from "@tanstack/react-table";
import { UserResponseType } from "@webcampus/schemas/admin";
import { AdminDepartmentActions } from "./admin-department-actions";

export const adminDepartmentColumns: ColumnDef<UserResponseType>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
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
