"use client";

import { ProjectMappingDetailView } from "@/modules/department/project-mapping/project-mapping-detail-view";
import { use } from "react";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default function DepartmentProjectMappingCoursePage({
  params,
}: PageProps) {
  const { courseId } = use(params);

  return (
    <ProjectMappingDetailView courseId={courseId} basePath="/department" />
  );
}
