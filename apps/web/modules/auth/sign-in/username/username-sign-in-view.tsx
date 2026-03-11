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
import { useUsernameSignInForm } from "./use-username-sign-in-form";

// 1. Add the role prop
export const UsernameSignIn = ({ role }: { role: string }) => {
  // 2. Pass the role to our updated hook
  const { form, onSubmit } = useUsernameSignInForm(role);

  // 3. Set up dynamic text based on the role
  const isStudent = role === "student";
  const title = isStudent ? "Student sign in" : "Applicant sign in";
  const idLabel = isStudent ? "USN" : "Application ID";
  const idPlaceholder = isStudent
    ? "Enter your USN"
    : "Enter your Application ID";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Welcome back! Please sign in to continue.
          </p>
        </div>
        <div className="grid gap-6">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{idLabel}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={idPlaceholder} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-3">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  <FormControl>
                    <PasswordInput
                      {...field}
                      placeholder="Enter your password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            disabled={form.formState.isSubmitting}
            type="submit"
            className="w-full"
          >
            {form.formState.isSubmitting ? "Signing in..." : "Continue"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
