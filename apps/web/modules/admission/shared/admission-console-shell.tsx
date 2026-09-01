import { cn } from "@webcampus/ui/lib/utils";
import { RoleHero } from "@/modules/role-hero";

type AdmissionConsoleShellProps = {
  children: React.ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
  showHero?: boolean;
  className?: string;
};

export function AdmissionConsoleShell({
  children,
  description,
  eyebrow = "TERM 2026 · ODD SEMESTER",
  showHero = false,
  className,
}: AdmissionConsoleShellProps) {
  return (
    <main className={cn("admission-console space-y-6", className)}>
      {showHero && (
        <RoleHero
          eyebrow={eyebrow}
          title={
            <>
              <span>Admissions,</span>
              <br />
              <span>moving in real time.</span>
            </>
          }
          description={description}
          image="/dashboard-admission.png"
        />
      )}
      {children}
    </main>
  );
}
