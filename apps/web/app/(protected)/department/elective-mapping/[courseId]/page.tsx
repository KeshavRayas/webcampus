"use client";

import { ElectiveMappingDetailView } from "@/modules/department/elective-mapping/elective-mapping-detail-view";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  return (
    <ElectiveMappingDetailView courseId={courseId} basePath="/department" />
  );
}
