"use client";

import { apiClient } from "@/lib/api-client";
import { useDepartmentNotices } from "@/modules/notices/use-notices";
import { RoleHero } from "@/modules/role-hero";
import { useQuery } from "@tanstack/react-query";
import type { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { BookOpen, Megaphone, Users } from "lucide-react";
import Link from "next/link";

type DepartmentInfo = { id?: string; name?: string; type?: string };
type Student = { id: string };
type Faculty = { id: string };

export default function DepartmentDashboardPage() {
  const department = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const response = (
        await apiClient.get<BaseResponse<DepartmentInfo>>(
          "/department/section/department-info"
        )
      ).data;
      return response.status === "success" ? response.data : null;
    },
  });
  const students = useQuery({
    queryKey: ["department-dashboard-students"],
    queryFn: async () => {
      const response = (
        await apiClient.get<BaseResponse<Student[]>>("/department/student")
      ).data;
      return response.status === "success" ? (response.data ?? []) : [];
    },
  });
  const faculty = useQuery({
    queryKey: ["department-dashboard-faculty"],
    queryFn: async () => {
      const response = (
        await apiClient.get<BaseResponse<Faculty[]>>("/department/faculty")
      ).data;
      return response.status === "success" ? (response.data ?? []) : [];
    },
  });
  const courses = useQuery({
    queryKey: ["department-dashboard-courses"],
    queryFn: async () => {
      const response = (
        await apiClient.get<BaseResponse<unknown[]>>(
          "/department/course/branch"
        )
      ).data;
      return response.status === "success" ? (response.data ?? []) : [];
    },
  });
  const notices = useDepartmentNotices();

  const value = (loading: boolean, count?: number) =>
    loading ? "..." : (count ?? 0);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <RoleHero
        eyebrow="Department portal"
        title={department.data?.name ?? "Run your department with clarity."}
        description="Faculty, students, courses, and notices under one roof."
        image="/dashboard-department.png"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Students",
            value: value(students.isLoading, students.data?.length),
            icon: Users,
          },
          {
            title: "Faculty",
            value: value(faculty.isLoading, faculty.data?.length),
            icon: Users,
          },
          {
            title: "Active courses",
            value: value(courses.isLoading, courses.data?.length),
            icon: BookOpen,
          },
          {
            title: "Published notices",
            value: value(
              notices.isLoading,
              notices.data?.filter((notice) => notice.status === "PUBLISHED")
                .length
            ),
            icon: Megaphone,
          },
        ].map(({ title, value: cardValue, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{cardValue}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Timetable management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Create, review, and publish department timetable entries with
              conflict detection.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/department/timetable">Open timetable</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Department notices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {notices.data?.length
                ? `${notices.data.length} notice(s) configured`
                : "No notices created yet."}
            </p>
            <Button asChild variant="outline">
              <Link href="/department/notices">Manage notices</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="dashboard-action-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild variant="outline">
            <Link href="/department/timetable">Manage timetable</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/department/courses">Manage courses</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/department/faculty">Faculty directory</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/department/student">Student directory</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
