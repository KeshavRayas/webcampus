"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { AccountsView } from "@/modules/accounts/accounts-view";
import React from "react";

export const TrustView = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trustee overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Trustee dashboard for management quota admissions and fee oversight.
          </p>
        </CardContent>
      </Card>
      <AccountsView />
    </div>
  );
};
