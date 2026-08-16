"use client";

import { AccountsView } from "@/modules/accounts/accounts-view";
import React from "react";

export const TrustView = () => {
  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground space-y-2 rounded-lg border p-6 shadow-sm">
        <h3 className="text-xl font-semibold tracking-tight">Trust</h3>
        <p className="text-muted-foreground text-sm">
          Trustee dashboard for management quota admissions.
        </p>
      </div>
      <AccountsView />
    </div>
  );
};
