"use client";

import { ColumnDef } from "@tanstack/react-table";
import { SemesterResponseType } from "@webcampus/schemas/admin";
import dayjs from "dayjs";
import { AdminSemesterActions } from "./admin-semester-actions";

export const AdminSemesterColumns: ColumnDef<SemesterResponseType>[] = [
  {
    accessorKey: "id",
    header: "ID",
    meta: { enableCopy: true },
  },
  {
    id: "name",
    header: "Name",
    accessorFn: (row) => `${row.type.toUpperCase()} ${row.year}`,
    meta: { enableCopy: true },
  },
  {
    accessorKey: "endDate",
    header: "End Date",
    cell: ({ row }) => dayjs(row.original.endDate).format("DD/MM/YYYY"),
    accessorFn: (row) => dayjs(row.endDate).format("DD/MM/YYYY"),
    meta: { enableCopy: true },
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => dayjs(row.original.startDate).format("DD/MM/YYYY"),
    accessorFn: (row) => dayjs(row.startDate).format("DD/MM/YYYY"),
    meta: { enableCopy: true },
  },
  {
    accessorKey: "year",
    header: "Year",
  },
  {
    accessorKey: "isCurrent",
    header: "Is Current",
    cell: ({ row }) => {
      return <div>{row.original.isCurrent ? "Yes" : "No"}</div>;
    },
  },
  {
    accessorKey: "userId",
    header: "User ID",
    meta: { enableCopy: true },
  },
  {
    id: "actions",
    cell: ({ row }) => <AdminSemesterActions semester={row.original} />,
  },
];
