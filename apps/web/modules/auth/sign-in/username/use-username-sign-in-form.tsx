"use client";

import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import z from "zod";

export const useUsernameSignInForm = (role: string) => {
  const router = useRouter();

  // Move the schema inside so it can use the dynamic role for error messages
  const signInSchema = z.object({
    username: z
      .string()
      .min(
        1,
        role === "student" ? "USN is required" : "Application ID is required"
      ),
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    await authClient.signIn.username(data, {
      onError: (error) => {
        toast.error(error.error.message);
      },
      onSuccess: () => {
        toast.success("Signed in successfully!");
        // Dynamically route them to their respective dashboard!
        router.push(`/${role}`);
      },
      onRetry: () => {
        toast.info("Retrying sign in...");
      },
    });
  };

  return { form, onSubmit };
};
