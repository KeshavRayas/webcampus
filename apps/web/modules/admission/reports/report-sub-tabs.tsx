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
    <div className="admission-report-subtabs flex flex-wrap items-center gap-2 rounded-full border p-1">
      {REPORT_TABS.map((tab) => {
        const isActive = pathname === tab.url;
        return (
          <Link
            key={tab.url}
            href={tab.url}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
