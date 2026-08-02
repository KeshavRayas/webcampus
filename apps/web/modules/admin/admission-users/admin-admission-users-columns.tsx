"use client";

import { ColumnDef } from "@tanstack/react-table";
import React from "react";
import { AdminAdmissionUsersActions } from "./admin-admission-users-actions";

export type AdminAdmissionUserResponse = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image?: string | null;
  photo?: string; // <-- Added photo to the type
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
    // <-- Created At column completely removed here
    {
      id: "actions",
      cell: ({ row }) => <AdminAdmissionUsersActions user={row.original} />,
    },
  ];
