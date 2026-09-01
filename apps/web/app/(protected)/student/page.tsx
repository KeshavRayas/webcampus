"use client";

import { useStudentNotices } from "@/modules/notices/use-notices";
import { useStudentProfile } from "@/modules/student/profile/use-student-profile";
import { RoleHero } from "@/modules/role-hero";
import { downloadTimetablePdf } from "@/modules/timetable/timetable-pdf";
import {
  useStudentTimetable,
  useStudentTodayTimetable,
} from "@/modules/timetable/use-timetable";
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
  Download,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

const quickActions = [
  { label: "View timetable", href: "/student/timetable", icon: CalendarDays },
  { label: "Attendance", href: "/student/attendance", icon: GraduationCap },
];

export default function StudentDashboardPage() {
  const profile = useStudentProfile();
  const semesterId = profile.data?.semesterId ?? undefined;
  const sectionId = profile.data?.sectionId ?? undefined;
  const timetable = useStudentTodayTimetable(semesterId, sectionId);
  const weeklyTimetable = useStudentTimetable(semesterId, sectionId);
  const notices = useStudentNotices();
  const classes = timetable.data ?? [];
  const scheduleReady = Boolean(semesterId && sectionId);
  const studentName = profile.data?.user.name ?? "Student";
  const handleDownload = () => {
    downloadTimetablePdf({
      entries: weeklyTimetable.data?.entries ?? [],
      slots: weeklyTimetable.data?.slots,
      student: profile.data,
    });
  };
  return (
    <div className="flex flex-1 flex-col gap-6">
      <RoleHero
        eyebrow="Student portal"
        title={`Welcome, ${studentName}`}
        description={`Semester ${profile.data?.semesterNumber ?? profile.data?.currentSemester ?? "-"} · ${profile.data?.departmentName ?? "Your academic workspace"}`}
        image="/dashboard-students.png"
      />

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
              {!scheduleReady || timetable.isLoading ? "..." : classes.length}
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
            <Button asChild className="h-[3.15rem]" variant="outline">
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
                {scheduleReady
                  ? "No classes scheduled for today."
                  : "Section not assigned yet."}
              </p>
            )}
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
              <Link href="/student/notices">View all notices</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="dashboard-action-grid grid gap-2 sm:grid-cols-3">
          {quickActions.map(({ label, href, icon: Icon }) => (
            <Button
              asChild
              className="h-[3.15rem] justify-start"
              key={href}
              variant="outline"
            >
              <Link href={href}>
                <Icon />
                {label}
              </Link>
            </Button>
          ))}
          <Button
            className="h-[3.15rem] justify-start"
            disabled={!weeklyTimetable.data?.entries.length}
            onClick={handleDownload}
            variant="outline"
          >
            <Download />
            Download timetable
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
