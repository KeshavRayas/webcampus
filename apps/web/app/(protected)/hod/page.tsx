import { RoleHero } from "@/modules/role-hero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Users, GraduationCap, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@webcampus/ui/components/button";

const stats = [
  { label: "Faculty", value: "—", note: "Under your department", icon: Users },
  { label: "Courses", value: "—", note: "Active this semester", icon: BookOpen },
  { label: "Students", value: "—", note: "Across all sections", icon: GraduationCap },
];

export default function HODDashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <RoleHero
        eyebrow="Head of department"
        title="Lead your department with clarity."
        description="Oversee faculty, courses, attendance, marks, and condonation from one calm workspace."
        image="/dashboard-hod.png"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-muted-foreground text-xs">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="dashboard-action-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild variant="outline">
            <Link href="/hod/faculty">Faculty directory</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/hod/attendance/report">Attendance report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/hod/marks/report">Marks report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/hod/condonation/approve">Condonation</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
