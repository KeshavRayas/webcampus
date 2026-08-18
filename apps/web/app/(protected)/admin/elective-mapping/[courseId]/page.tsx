"use client";

import { ElectiveMappingDetailView } from "@/modules/department/elective-mapping/elective-mapping-detail-view";
import { useSearchParams } from "next/navigation";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const searchParams = useSearchParams();
  const departmentId = searchParams.get("departmentId") ?? undefined;

  return (
    <ElectiveMappingDetailView
      courseId={courseId}
      basePath="/admin"
      departmentId={departmentId}
    />
  );
}
