import React from "react";

export const DataField = ({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) => {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="break-words font-medium">{value || "-"}</p>
    </div>
  );
};
