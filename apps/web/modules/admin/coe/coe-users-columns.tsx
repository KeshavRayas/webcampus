"use client";

import { ColumnDef } from "@tanstack/react-table";
import React from "react";
import { CoeUsersActions } from "./coe-users-actions";

export type CoeUserResponse = {
  id: string;
  name: string;
  email: string;
  username: string; // We keep this in the type so the Edit form can access it!
  photo?: string;
};

export const CoeUserColumns: ColumnDef<CoeUserResponse>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  // Username column intentionally removed here
  {
    id: "actions",
    cell: ({ row }) => <CoeUsersActions user={row.original} />,
  },
];
