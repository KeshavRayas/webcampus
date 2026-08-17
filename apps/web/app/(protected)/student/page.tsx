"use client";

import { useStudentProfile } from "@/modules/student/profile/use-student-profile";
import { useStudentTimetable } from "@/modules/timetable/use-timetable";
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
  ClipboardList,
  Download,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

const quickActions = [
  { label: "View timetable", href: "/student/timetable", icon: CalendarDays },
  {
    label: "Download timetable",
    href: "/student/timetable/download",
    icon: Download,
  },
  { label: "Assignments", href: "/student/assignments", icon: ClipboardList },
  { label: "Attendance", href: "/student/attendance", icon: GraduationCap },
];

export default function StudentDashboardPage() {
  const profile = useStudentProfile();
  const timetable = useStudentTimetable(profile.data?.semesterId ?? undefined);
  const classes = timetable.data ?? [];
  const studentName = profile.data?.user.name ?? "Student";
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString()}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {studentName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Semester{" "}
          {profile.data?.semesterNumber ?? profile.data?.currentSemester ?? "-"}{" "}
          · {profile.data?.departmentName ?? "-"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">USN</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {profile.data?.usn ?? "Not available"}
            </p>
            <p className="text-muted-foreground text-xs">
              Authenticated student
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Academic year</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {profile.data?.academicYear ?? "Not available"}
            </p>
            <p className="text-muted-foreground text-xs">
              Current academic record
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Today&apos;s classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {timetable.isLoading ? "..." : classes.length}
            </p>
            <p className="text-muted-foreground text-xs">
              From published timetable
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Today's timetable</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/student/timetable">
                Full timetable
                <ExternalLink />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.map((item, index) => (
              <div
                className={`rounded-lg border p-4 ${index === 0 ? "border-primary/50 bg-primary/5" : ""}`}
                key={item.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {item.course?.code ?? "Course"} ·{" "}
                      {item.course?.name ?? "Unnamed course"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {item.faculty?.user?.name ??
                        item.faculty?.shortName ??
                        "Faculty not assigned"}
                    </p>
                  </div>
                  <p className="text-muted-foreground shrink-0 text-sm">
                    {item.startTime} - {item.endTime}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline">{item.classType}</Badge>
                  <span className="text-muted-foreground text-sm">
                    {item.roomNumber}
                  </span>
                </div>
              </div>
            ))}
            {!timetable.isLoading && classes.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No classes scheduled for today.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Assignment data is not available from the current API.
            </p>
            <Button asChild className="w-full" variant="link">
              <Link href="/student/assignments">View all assignments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Notice data is not available from the current API.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {quickActions.map(({ label, href, icon: Icon }) => (
              <Button
                asChild
                className="justify-start"
                key={href}
                variant="outline"
              >
                <Link href={href}>
                  <Icon />
                  {label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
