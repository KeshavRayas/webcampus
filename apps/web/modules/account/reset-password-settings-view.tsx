"use client";

import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { PasswordInput } from "@webcampus/ui/components/password-input";
import React from "react";
import { useResetPasswordSettingsForm } from "./use-reset-password-settings-form";

export const ResetPasswordSettingsView = () => {
  const { form, onSubmit, step } = useResetPasswordSettingsForm();

  return (
    <Card className="mx-auto mt-8 max-w-xl">
      <CardHeader>
        <CardTitle>
          {step === "request" ? "Change Password" : "Verify OTP"}
        </CardTitle>
        <CardDescription>
          {step === "request"
            ? "Update your password. We will send an OTP to your email to verify this change."
            : "Enter the OTP sent to your email to complete the password change."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className={step === "verify" ? "hidden" : ""}>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter your email" readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className={step === "verify" ? "hidden" : ""}>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      {...field}
                      placeholder="Enter new password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className={step === "verify" ? "hidden" : ""}>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      {...field}
                      placeholder="Re-type new password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {step === "verify" && (
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OTP Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter the 6-digit OTP" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full">
              {step === "request" ? "Send OTP" : "Change Password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
