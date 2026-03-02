"use client";

import { authClient } from "@/lib/auth-client"; // 1. Import authClient
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { DataTable } from "@webcampus/ui/components/data-table";
import axios from "axios";
import React from "react";
import { DepartmentCoursesColumns } from "./department-courses-columns";

export const DepartmentCoursesTable = () => {
  // 2. Fetch the session to get the current department's name
  const { data: session } = authClient.useSession();
  const departmentName = session?.user?.name;

  const { data: courses, isLoading } = useQuery({
    // 3. Add departmentName to queryKey so it caches correctly
    queryKey: ["courses", departmentName],
    queryFn: () =>
      axios.get(
        `${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/department/course/branch`,
        {
          // 4. Pass the dynamic department name
          params: { name: departmentName },
          withCredentials: true,
        }
      ),
    // 5. Prevent the query from running before the session is loaded
    enabled: !!departmentName,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <DataTable
      columns={DepartmentCoursesColumns}
      // Safely fallback to an empty array if data is missing
      data={courses?.data?.data || []}
    />
  );
};
