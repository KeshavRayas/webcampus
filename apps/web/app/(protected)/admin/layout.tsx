import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-console min-w-0">
      <div className="admin-page-content">{children}</div>
    </div>
  );
}
