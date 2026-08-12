"use client";

import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character");

const resetPasswordSettingsSchema = z
  .object({
    email: z.email("Invalid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
    otp: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordSettingsFormValues = z.infer<
  typeof resetPasswordSettingsSchema
>;

export const useResetPasswordSettingsForm = () => {
  const [step, setStep] = useState<"request" | "verify">("request");
  const { data: session } = authClient.useSession();

  const form = useForm<ResetPasswordSettingsFormValues>({
    resolver: zodResolver(resetPasswordSettingsSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      otp: "",
    },
  });

  useEffect(() => {
    if (session?.user?.email) {
      form.setValue("email", session.user.email);
    }
  }, [session?.user?.email, form]);

  const onSubmit = async (data: ResetPasswordSettingsFormValues) => {
    if (step === "request") {
      await authClient.emailOtp.sendVerificationOtp(
        {
          email: data.email,
          type: "forget-password",
        },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (ctx: any) => {
            toast.dismiss();
            toast.error(ctx.error?.message || "Failed to send OTP");
          },
          onRequest: () => {
            toast.info("Sending OTP to your email...");
          },
          onSuccess: () => {
            toast.dismiss();
            toast.success("OTP sent to your email!");
            setStep("verify");
          },
        }
      );
    } else if (step === "verify") {
      if (!data.otp) {
        form.setError("otp", { message: "OTP is required" });
        return;
      }
      await authClient.emailOtp.resetPassword(
        {
          email: data.email,
          otp: data.otp,
          password: data.password,
        },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (ctx: any) => {
            toast.dismiss();
            toast.error(ctx.error?.message || "Failed to reset password");
          },
          onRequest: () => {
            toast.info("Verifying and resetting password...");
          },
          onSuccess: () => {
            toast.dismiss();
            toast.success("Password reset successfully!");
            // Reset form state back to start
            setStep("request");
            form.reset({
              ...form.getValues(),
              password: "",
              confirmPassword: "",
              otp: "",
            });
          },
        }
      );
    }
  };

  return {
    form,
    onSubmit,
    step,
  };
};
