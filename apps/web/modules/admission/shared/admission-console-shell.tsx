import { cn } from "@webcampus/ui/lib/utils";

type AdmissionConsoleShellProps = {
  children: React.ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
  className?: string;
};

export function AdmissionConsoleShell({
  children,
  description,
  eyebrow = "TERM 2026 · ODD SEMESTER",
  className,
}: AdmissionConsoleShellProps) {
  return (
    <main className={cn("admission-console space-y-6", className)}>
      <section className="admission-hero admission-console-hero">
        <div className="admission-hero-copy">
          <p className="admission-eyebrow">{eyebrow}</p>
          <h1>
            <span>Admissions,</span>
            <br />
            <span>moving in real time.</span>
          </h1>
          <p>{description}</p>
        </div>
      </section>
      {children}
    </main>
  );
}
