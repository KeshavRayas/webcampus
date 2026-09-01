"use client";

import { useFacultyNotices } from "@/modules/notices/use-notices";
import { RoleHero } from "@/modules/role-hero";
import {
  useFacultyCurrentSemester,
  useFacultyTodayTimetable,
} from "@/modules/timetable/use-timetable";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import Link from "next/link";

export default function FacultyDashboardPage() {
  const { currentSemesterId } = useFacultyCurrentSemester();
  const timetable = useFacultyTodayTimetable(currentSemesterId);
  const notices = useFacultyNotices();
  const classCount = timetable.data?.length ?? 0;
  const scheduleReady = Boolean(currentSemesterId);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <RoleHero
        eyebrow="Faculty portal"
        title="Your teaching day, at a glance."
        description="Teach, mark attendance, and manage grades from one calm place."
        image="/dashboard-faculty.png"
      />
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
                {scheduleReady
                  ? "No classes scheduled for today."
                  : "Loading semester…"}
              </p>
            )}
            <Button asChild className="mt-2 h-[3.15rem]" variant="outline">
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
        <CardContent className="dashboard-action-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Button asChild className="h-[3.15rem]" variant="outline">
            <Link href="/faculty/timetable">Timetable</Link>
          </Button>
          <Button asChild className="h-[3.15rem]" variant="outline">
            <Link href="/faculty/attendance/take">Take attendance</Link>
          </Button>
          <Button asChild className="h-[3.15rem]" variant="outline">
            <Link href="/faculty/marks">Enter marks</Link>
          </Button>
          <Button asChild className="h-[3.15rem]" variant="outline">
            <Link href="/faculty/question-paper-setup">Question papers</Link>
          </Button>
          <Button asChild className="h-[3.15rem]" variant="outline">
            <Link href="/faculty/profile">My profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
