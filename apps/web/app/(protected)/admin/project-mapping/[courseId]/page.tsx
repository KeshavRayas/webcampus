"use client";

import { ProjectMappingDetailView } from "@/modules/department/project-mapping/project-mapping-detail-view";
import { useSearchParams } from "next/navigation";
import { use } from "react";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default function AdminProjectMappingCoursePage({ params }: PageProps) {
  const { courseId } = use(params);
  const searchParams = useSearchParams();
  const departmentId = searchParams.get("departmentId") ?? undefined;

  return (
    <ProjectMappingDetailView
      courseId={courseId}
      basePath="/admin"
      departmentId={departmentId}
    />
  );
}
