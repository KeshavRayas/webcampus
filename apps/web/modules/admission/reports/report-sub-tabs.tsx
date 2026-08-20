"use client";

import { cn } from "@webcampus/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const REPORT_TABS = [
  { name: "Admission", url: "/admission/reports/admission" },
  { name: "Cancellation", url: "/admission/reports/cancellation" },
  { name: "Fee", url: "/admission/reports/fee" },
] as const;

export function ReportSubTabs() {
  const pathname = usePathname();

  return (
    <div className="admission-report-tabs flex flex-wrap items-center gap-2">
      {REPORT_TABS.map((tab) => {
        const isActive = pathname === tab.url;
        return (
          <Link
            key={tab.url}
            href={tab.url}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
