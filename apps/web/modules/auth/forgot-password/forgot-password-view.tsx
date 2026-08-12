"use client";

import { Button } from "@webcampus/ui/components/button";
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
import Link from "next/link";
import React from "react";
import { useForgotPasswordForm } from "./use-forgot-password-form";

export const ForgotPassword = () => {
  const { form, onSubmit, step } = useForgotPasswordForm();

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={"flex flex-col gap-6"}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">
            {step === "request" ? "Reset Password" : "Verify OTP"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {step === "request"
              ? "Enter your email and new password to request a reset."
              : "Enter the OTP sent to your email to complete the reset."}
          </p>
        </div>
        <div className="grid gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className={step === "verify" ? "hidden" : ""}>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter your email" />
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
                  <PasswordInput {...field} placeholder="Enter new password" />
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
            {step === "request" ? "Send OTP" : "Reset Password"}
          </Button>
        </div>
        <div className="text-muted-foreground text-center text-sm">
          Remembered your password?{" "}
          <Link href="/sign-in" className="underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </form>
    </Form>
  );
};
