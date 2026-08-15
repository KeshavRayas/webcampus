"use client";

import { DataTable } from "@webcampus/ui/components/data-table";
import React from "react";
import { AccountsForm } from "./accounts-form";
import { AccountsUserColumns } from "./accounts-users-columns";
import { useAccountsUsersQuery } from "./use-accounts-users";

export const AccountsView = () => {
  const { data: accountsUsers, isLoading } = useAccountsUsersQuery();

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">Accounts</h3>
          <AccountsForm />
        </div>

        {isLoading ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            Loading Accounts users...
          </div>
        ) : accountsUsers && accountsUsers.length > 0 ? (
          <DataTable columns={AccountsUserColumns} data={accountsUsers} />
        ) : (
          <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
            No Accounts users found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
};
