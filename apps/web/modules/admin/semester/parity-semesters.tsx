"use client";

import { TermParitySchema } from "@webcampus/schemas/admin";
import { cn } from "@webcampus/ui/lib/utils";
import { z } from "zod";

export const PARITY_SEMESTERS: Record<
  z.infer<typeof TermParitySchema>,
  { ug: number[]; pg: number[] }
> = {
  odd: { ug: [1, 3, 5, 7], pg: [1, 3] },
  even: { ug: [2, 4, 6, 8], pg: [2, 4] },
};

const ChipRow = ({
  program,
  numbers,
}: {
  program: string;
  numbers: number[];
}) => (
  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
    <span className="text-muted-foreground w-6 shrink-0 text-[10px] font-bold tracking-widest">
      {program}
    </span>
    {numbers.map((num) => (
      <span
        key={num}
        className="bg-muted/60 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium"
      >
        Sem {num}
      </span>
    ))}
  </div>
);

export const ParitySemesterChips = ({ parity }: { parity: "odd" | "even" }) => (
  <div className="flex flex-col gap-1.5">
    <ChipRow program="UG" numbers={PARITY_SEMESTERS[parity].ug} />
    <ChipRow program="PG" numbers={PARITY_SEMESTERS[parity].pg} />
  </div>
);

export const ParityBadge = () => (
  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
    SUPPLEMENTARY
  </span>
);

export const ParityCardClasses = ({ selected }: { selected: boolean }) =>
  cn(
    "shadow-sm rounded-md border border-l-4 p-4 text-left transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
    selected
      ? "border-primary/40 border-l-primary bg-primary/[0.04] ring-primary/15 ring-[3px]"
      : "hover:border-primary/30 border-border border-l-[#e2e8f0]"
  );
