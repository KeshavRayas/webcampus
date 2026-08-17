"use client";

import { AccountsView } from "@/modules/accounts/accounts-view";
import { frontendEnv } from "@webcampus/common/env";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Button } from "@webcampus/ui/components/button";
import axios from "axios";
import { Building2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useTrustSession } from "./use-trust-session";

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return (parts[0] ?? "T").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? "T"}${parts[1]?.[0] ?? "R"}`.toUpperCase();
};

export const TrustView = () => {
  const { data: trustUser, isLoading } = useTrustSession();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
      await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/trust/auth/logout`,
        {},
        { withCredentials: true }
      );
    } catch {
      // Ignore network errors during sign out; local cookie is still cleared.
    }
    document.cookie = "trust_token=; path=/; max-age=0; SameSite=Lax";
    router.push("/trust/login");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg border p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-tight">Trust</h3>
            <p className="text-muted-foreground text-sm">
              Trustee dashboard for management quota admissions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="text-muted-foreground text-sm">
              Loading profile...
            </div>
          ) : trustUser ? (
            <>
              <div className="text-right">
                <p className="text-sm font-semibold">{trustUser.name}</p>
                <p className="text-muted-foreground text-xs">
                  {trustUser.email}
                </p>
              </div>
              <Avatar className="h-10 w-10 border">
                <AvatarImage
                  src={trustUser.image || undefined}
                  alt={`${trustUser.name} profile photo`}
                />
                <AvatarFallback className="text-xs font-semibold">
                  {getInitials(trustUser.name)}
                </AvatarFallback>
              </Avatar>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>

      <AccountsView />
    </div>
  );
};
