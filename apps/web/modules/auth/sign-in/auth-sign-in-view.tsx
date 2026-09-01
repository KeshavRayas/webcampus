"use client";

import { authClient } from "@/lib/auth-client";
import { roles } from "@webcampus/types/rbac";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { capitalize } from "@webcampus/ui/lib/utils";
import { Eye, EyeOff, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

const roleOptions = roles.map((role) => ({
  value: role,
  label: `${capitalize(role.replace("-", " "))} Sign In`,
}));

const domainOptions = ["@bmsce.ac.in", "@webcampus.com"] as const;

export function AuthSignInView({
  initialRole = "student",
}: {
  initialRole?: string;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [domain, setDomain] =
    useState<(typeof domainOptions)[number]>("@bmsce.ac.in");

  const isApplicant = selectedRole === "applicant";

  const handleSubmit = async () => {
    if (!identifier.trim()) {
      toast.error(
        isApplicant ? "Application ID is required" : "Email is required"
      );
      return;
    }
    if (!password) {
      toast.error("Password is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isApplicant) {
        const username = identifier.trim().toLowerCase();
        await authClient.signIn.username(
          { username, password },
          {
            onError: (error) => {
              toast.error(error.error.message);
            },
            onSuccess: () => {
              toast.success("Signed in successfully!");
              router.push("/applicant");
            },
            onRetry: () => {
              toast.info("Retrying sign in...");
            },
          }
        );
      } else {
        const email = `${identifier.trim()}${domain}`;
        await authClient.signIn.email(
          { email, password },
          {
            onError: (error) => {
              toast.error(error.error.message);
            },
            onSuccess: () => {
              toast.success("Signed in successfully!");
              router.push(
                selectedRole === "admission" ? "/admission" : `/${selectedRole}`
              );
            },
            onRetry: () => {
              toast.info("Retrying sign in...");
            },
          }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-svh grid-cols-1 bg-[var(--auth-bg)] lg:grid-cols-2">
      <section className="flex min-h-svh flex-col bg-[var(--auth-bg)] px-[7.8%] py-8 text-[var(--auth-foreground)] sm:px-10 lg:px-[10.8%] lg:py-8">
        <header className="shrink-0 pt-[8px]">
          <div className="text-[17px] font-extrabold leading-none tracking-[0.01em] text-[var(--auth-foreground)]">
            BMSU
          </div>
        </header>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-[500px] lg:-mt-2">
            <div>
              <h1 className="text-[clamp(2.5rem,3.45vw,3.45rem)] font-extrabold leading-[0.98] tracking-[-0.06em] text-[var(--auth-foreground)]">
                Welcome back.
              </h1>
              <p className="mt-3 text-[16px] font-normal leading-[1.25] tracking-[-0.015em] text-[var(--auth-foreground-muted)]">
                Pick up where you left off.
              </p>
            </div>

            <div className="mt-[36px] space-y-[14px]">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="!h-[62px] !min-h-[62px] w-full shrink-0 rounded-full border border-[var(--auth-border)] bg-[var(--auth-bg)] px-[22px] py-0 text-left text-[16px] font-medium tracking-[-0.02em] text-[var(--auth-foreground)] shadow-none outline-none ring-0 transition-colors hover:bg-[var(--auth-bg)] focus:ring-0 focus-visible:ring-0 [&>svg]:mr-[2px] [&>svg]:size-[17px] [&>svg]:text-[var(--auth-muted-2)]">
                  <div className="flex h-full min-w-0 flex-1 items-center gap-[14px]">
                    <UserRound className="size-[19px] shrink-0 stroke-[1.7] text-[var(--auth-icon)]" />
                    <SelectValue placeholder="Select an option" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-80 rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-bg)] p-2 text-[var(--auth-foreground)]">
                  {roleOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="hover:bg-[var(--auth-foreground)]/10 focus:bg-[var(--auth-foreground)]/10 rounded-xl px-3 py-2.5 text-base text-[var(--auth-foreground)]"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex h-[62px] overflow-hidden rounded-full border border-[var(--auth-border)] bg-[var(--auth-bg)]">
                <div className="flex w-[58px] shrink-0 items-center justify-center text-[var(--auth-icon)]">
                  {isApplicant ? (
                    <UserRound className="size-[19px] stroke-[1.7]" />
                  ) : (
                    <Mail className="size-[19px] stroke-[1.7]" />
                  )}
                </div>
                <input
                  aria-label={isApplicant ? "Application ID" : "Email"}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  className="h-full min-w-0 flex-1 bg-transparent px-[2px] text-[16px] font-normal tracking-[-0.015em] text-[var(--auth-foreground)] outline-none placeholder:text-[var(--auth-muted)]"
                  placeholder={isApplicant ? "Application ID" : "your.name"}
                  autoComplete={isApplicant ? "username" : "email"}
                />
                {!isApplicant && (
                  <div className="my-[7px] mr-[7px] flex shrink-0 items-center rounded-full border border-[var(--auth-border)] bg-[var(--auth-surface)] px-[15px]">
                    <Select
                      value={domain}
                      onValueChange={(value) =>
                        setDomain(value as (typeof domainOptions)[number])
                      }
                    >
                      <SelectTrigger className="h-[46px] w-auto min-w-0 gap-1 border-0 !bg-[var(--auth-surface)] bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--auth-foreground)] shadow-none outline-none ring-0 hover:!bg-[var(--auth-surface)] focus:ring-0 focus-visible:ring-0 [&>svg]:size-[15px] [&>svg]:text-[var(--auth-muted-2)]">
                        <SelectValue aria-label={domain} />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-surface)] p-2 text-[var(--auth-foreground)] shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
                        {domainOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className="hover:bg-[var(--auth-foreground)]/10 focus:bg-[var(--auth-foreground)]/10 rounded-xl px-3 py-2.5 text-[15px] text-[var(--auth-foreground)] outline-none"
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex h-[62px] overflow-hidden rounded-full border border-[var(--auth-border)] bg-[var(--auth-surface)]">
                <input
                  aria-label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="h-full min-w-0 flex-1 bg-transparent px-[22px] text-[16px] font-normal tracking-[-0.015em] text-[var(--auth-foreground)] outline-none placeholder:text-[var(--auth-muted)]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="mr-[18px] flex shrink-0 items-center text-[var(--auth-muted-2)] transition-colors hover:text-[var(--auth-foreground-muted)] focus:outline-none focus-visible:text-[var(--auth-foreground)]"
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px] stroke-[1.7]" />
                  ) : (
                    <Eye className="size-[18px] stroke-[1.7]" />
                  )}
                </button>
              </div>

              <div className="pt-[8px]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="focus:ring-[var(--auth-foreground)]/40 h-[62px] w-full rounded-full bg-[var(--auth-accent)] text-[16px] font-bold tracking-[-0.015em] text-[var(--auth-accent-foreground)] transition-colors hover:opacity-90 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Signing in..." : "Continue"}
                </button>
              </div>
            </div>

            <p className="mt-[29px] text-[14px] font-normal tracking-[-0.015em] text-[var(--auth-muted)]">
              New to the portal?{" "}
              <Link
                href="/"
                className="font-semibold text-[var(--auth-link)] underline underline-offset-[2px] transition-colors hover:text-[var(--auth-foreground)]"
              >
                Request access
              </Link>
            </p>
          </div>
        </div>

        <footer className="shrink-0 pt-5 text-[11px] font-normal leading-[1.35] tracking-[-0.01em] text-[var(--auth-footer)]">
          By continuing you agree to the library&apos;s acceptable use policy
          and privacy notice.
        </footer>
      </section>

      <aside className="relative hidden min-h-svh overflow-hidden lg:block">
        <img
          src="/auth-campus-hero.png"
          alt="BMSCE campus building"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </aside>
    </main>
  );
}

export default AuthSignInView;
