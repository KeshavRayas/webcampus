import { ColumnDef } from "@tanstack/react-table";
import { TrustActions } from "./trust-actions";
import { TrustUser } from "./trust-types";

export const TrustUserColumns: ColumnDef<TrustUser>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "username",
    header: "Username",
    cell: ({ row }) => row.original.username || "-",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    id: "actions",
    cell: ({ row }) => <TrustActions user={row.original} />,
  },
];
