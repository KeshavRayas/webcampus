"use client";

import { apiClient } from "@/lib/api-client";
import { useFacultyNotices } from "@/modules/notices/use-notices";
import { useFacultyTimetable } from "@/modules/timetable/use-timetable";
import { useQuery } from "@tanstack/react-query";
import type { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  CalendarDays,
  ClipboardCheck,
  FileQuestion,
  Users,
} from "lucide-react";
import Link from "next/link";

type Course = {
  id: string;
  course?: { code?: string; name?: string } | null;
  code?: string;
  name?: string;
};

export default function FacultyDashboardPage() {
  const courses = useQuery({
    queryKey: ["faculty-dashboard-courses"],
    queryFn: async () => {
      const response = (
        await apiClient.get<BaseResponse<Course[]>>("/faculty/handling/courses")
      ).data;
      return response.status === "success" ? (response.data ?? []) : [];
    },
  });
  const timetable = useFacultyTimetable();
  const notices = useFacultyNotices();
  const courseCount = courses.data?.length ?? 0;
  const classCount = timetable.data?.length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString()}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Faculty dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Your teaching schedule and pending academic work
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Today's classes",
            value: timetable.isLoading ? "..." : classCount,
            icon: CalendarDays,
          },
          { title: "Attendance pending", value: "View", icon: ClipboardCheck },
          {
            title: "Courses handled",
            value: courses.isLoading ? "..." : courseCount,
            icon: Users,
          },
          { title: "Papers pending", value: "View", icon: FileQuestion },
        ].map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s teaching schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timetable.data?.slice(0, 4).map((entry) => (
              <div
                className="flex items-center justify-between rounded-lg border p-3"
                key={entry.id}
              >
                <div>
                  <p className="text-sm font-medium">
                    {entry.course?.code ?? "Course"} ·{" "}
                    {entry.course?.name ?? "Unnamed course"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {entry.roomNumber} · {entry.startTime} - {entry.endTime}
                  </p>
                </div>
                <Badge variant="outline">{entry.classType}</Badge>
              </div>
            ))}
            {!timetable.isLoading && !classCount && (
              <p className="text-muted-foreground text-sm">
                No timetable entries available.
              </p>
            )}
            <Button asChild className="mt-2" variant="outline">
              <Link href="/faculty/timetable">Open timetable</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notices.data?.slice(0, 3).map((notice) => (
              <div className="rounded-lg border p-3" key={notice.id}>
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{notice.title}</p>
                  <Badge variant="outline">{notice.priority}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {notice.content}
                </p>
              </div>
            ))}
            {!notices.data?.length && (
              <p className="text-muted-foreground text-sm">
                No notices available.
              </p>
            )}
            <Button asChild variant="link">
              <Link href="/faculty/notices">View all notices</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Button asChild variant="outline">
            <Link href="/faculty/timetable">Timetable</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/faculty/attendance/take">Take attendance</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/faculty/marks">Enter marks</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/faculty/question-paper-setup">Question papers</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/faculty/profile">My profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
