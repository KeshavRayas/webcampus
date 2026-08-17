"use client";

import { DataTable } from "@webcampus/ui/components/data-table";
import React from "react";
import { TrustForm } from "./trust-form";
import { TrustUserColumns } from "./trust-users-columns";
import { useTrustUsersQuery } from "./use-trust-users";

export const TrustView = () => {
  const { data: trustUsers, isLoading } = useTrustUsersQuery();

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">Trust</h3>
          <TrustForm />
        </div>

        {isLoading ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            Loading Trust users...
          </div>
        ) : trustUsers && trustUsers.length > 0 ? (
          <DataTable columns={TrustUserColumns} data={trustUsers} />
        ) : (
          <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
            No Trust users found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
};
