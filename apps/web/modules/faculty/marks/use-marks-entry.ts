"use client";

import { useQuery } from "@tanstack/react-query";
import { getMarksDashboardAssignments } from "./marks-api";

const STALE_TIME_MS = 5 * 60 * 1000;

export const useMarksDashboardAssignments = () => {
  return useQuery({
    queryKey: ["marks-dashboard-assignments"],
    queryFn: getMarksDashboardAssignments,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
};
