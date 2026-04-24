"use client";

import { cn } from "@webcampus/ui/lib/utils";
import * as React from "react";

interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 bg-muted data-[state=checked]:bg-primary peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent outline-none transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => {
        if (!disabled) {
          onCheckedChange?.(!checked);
        }
      }}
      {...props}
    >
      <span
        data-state={checked ? "checked" : "unchecked"}
        className="bg-background pointer-events-none block size-5 rounded-full shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      />
    </button>
  );
}

export { Switch };
