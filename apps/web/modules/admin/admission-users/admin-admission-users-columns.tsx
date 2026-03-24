"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { format } from "date-fns";
import React from "react";
import { AdminAdmissionUsersActions } from "./admin-admission-users-actions";

export type AdminAdmissionUserResponse = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
};

export const AdminAdmissionUserColumns: ColumnDef<AdminAdmissionUserResponse>[] =
  [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.role === "admission_admin" ? "Admin" : "Reviewer"}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => (
        <span suppressHydrationWarning>
          {format(new Date(row.original.createdAt), "PP")}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => <AdminAdmissionUsersActions user={row.original} />,
    },
  ];
