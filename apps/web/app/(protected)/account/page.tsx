import { ResetPasswordSettingsView } from "@/modules/account/reset-password-settings-view";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Account Settings",
};

export default function AccountSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-6 text-center text-3xl font-bold">Account Settings</h1>
      <ResetPasswordSettingsView />
    </div>
  );
}
