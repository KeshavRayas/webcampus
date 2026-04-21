import { cn } from "@webcampus/ui/lib/utils";

type AttendancePageShellProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  toastMessage?: string | null;
};

export const AttendancePageShell = ({
  children,
  footer,
  toastMessage,
}: AttendancePageShellProps) => {
  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-4.5rem)] min-h-0 flex-1 flex-col gap-4 pb-4"
      )}
    >
      <header className="space-y-1 px-1 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground text-sm">
          Record today&apos;s class attendance with fast controls and clear progress.
        </p>
      </header>

      {toastMessage ? (
        <div className="animate-in slide-in-from-top-2 fade-in-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</main>

      {footer ? (
        <footer className="sticky bottom-0 z-10 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur">
          {footer}
        </footer>
      ) : null}
    </div>
  );
};
