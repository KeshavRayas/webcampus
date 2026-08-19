"use client";

import { ColumnDef } from "@tanstack/react-table";
import React from "react";
import { AdminAdmissionInstructorsActions } from "./admin-admission-instructors-actions";

export type AdminAdmissionInstructorResponse = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image?: string | null;
  photo?: string;
};

export const AdminAdmissionInstructorColumns: ColumnDef<AdminAdmissionInstructorResponse>[] =
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
      id: "actions",
      cell: ({ row }) => (
        <AdminAdmissionInstructorsActions user={row.original} />
      ),
    },
  ];
