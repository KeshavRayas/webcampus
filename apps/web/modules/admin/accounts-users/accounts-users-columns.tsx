import { ColumnDef } from "@tanstack/react-table";
import { AccountsActions } from "./accounts-actions";
import { AccountsUser } from "./accounts-types";

export const AccountsUserColumns: ColumnDef<AccountsUser>[] = [
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
    cell: ({ row }) => <AccountsActions user={row.original} />,
  },
];
