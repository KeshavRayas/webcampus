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
    <div className="flex flex-wrap items-center gap-1 border-b">
      {REPORT_TABS.map((tab) => {
        const isActive = pathname === tab.url;
        return (
          <Link
            key={tab.url}
            href={tab.url}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
