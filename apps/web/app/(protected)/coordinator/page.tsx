import { RoleHero } from "@/modules/role-hero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Button } from "@webcampus/ui/components/button";
import { BookCopy, Users, FileBarChart } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Events", value: "—", note: "Coordinated this term", icon: BookCopy },
  { label: "Students", value: "—", note: "Under coordination", icon: Users },
  { label: "Reports", value: "—", note: "Generated so far", icon: FileBarChart },
];

export default function CoordinatorDashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <RoleHero
        eyebrow="Coordinator"
        title="Bring every event together."
        description="Plan events, engage students, and act on feedback."
        image="/dashboard-coordinator.png"
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
            <Link href="/coordinator/events">Events</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/coordinator/students">Students</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/coordinator/feedback">Feedback</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
