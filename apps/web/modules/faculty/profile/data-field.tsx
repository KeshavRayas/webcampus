import React from "react";

export const DataField = ({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) => {
  const asPill = typeof value === "string" && value.trim().length > 0;
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      {asPill ? (
        <span className="role-data-pill flex w-full items-center justify-between rounded-full px-3 py-1 text-sm font-medium">
          <span className="truncate">{value}</span>
        </span>
      ) : (
        <p className="break-words font-medium">{value || "-"}</p>
      )}
    </div>
  );
};
