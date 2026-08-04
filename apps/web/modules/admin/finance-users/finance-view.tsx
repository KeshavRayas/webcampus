"use client";

import { frontendEnv } from "@webcampus/common/env";
import { DataTable } from "@webcampus/ui/components/data-table";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FinanceUserColumns } from "./finance-users-columns";
import { FinanceForm } from "./finance-form";
import { FinanceUser } from "./finance-types";

export const FinanceView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isLoading, setIsLoading] = useState(true);
  const [financeUsers, setFinanceUsers] = useState<FinanceUser[]>([]);

  useEffect(() => {
    const fetchFinanceUsers = async () => {
      try {
        const response = await axios.get<{
          status: string;
          data: FinanceUser[];
        }>(`${NEXT_PUBLIC_API_BASE_URL}/admin/finance`, {
          withCredentials: true,
        });

        if (response.data.status === "success") {
          setFinanceUsers(response.data.data);
        }
      } catch {
        setFinanceUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinanceUsers();
  }, [NEXT_PUBLIC_API_BASE_URL]);

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">Finance Users</h3>
          <FinanceForm />
        </div>

        {isLoading ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            Loading Finance users...
          </div>
        ) : financeUsers && financeUsers.length > 0 ? (
          <DataTable columns={FinanceUserColumns} data={financeUsers} />
        ) : (
          <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
            No Finance users found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
};
