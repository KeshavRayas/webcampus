import { RoleHero } from "@/modules/role-hero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Button } from "@webcampus/ui/components/button";
import { Library, BookOpenText, GraduationCap } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Approvals", value: "—", note: "Pending course approvals", icon: Library },
  { label: "Examinations", value: "—", note: "Scheduled this term", icon: BookOpenText },
  { label: "Results", value: "—", note: "Published results", icon: GraduationCap },
];

export default function COEDashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <RoleHero
        eyebrow="Controller of examinations"
        title="Own the examination cycle."
        description="Approve courses, schedule examinations, and manage results from one calm workspace."
        image="/dashboard-coe.png"
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
        <CardContent className="dashboard-action-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button asChild variant="outline">
            <Link href="/coe/course-approvals">Course approvals</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/coe/feedback">Feedback</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/support">Raise an issue</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
