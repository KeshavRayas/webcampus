import { cn } from "@webcampus/ui/lib/utils";
import type * as React from "react";

function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border px-4 py-3 text-sm",
        className
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-medium", className)} {...props} />;
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("text-sm", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
