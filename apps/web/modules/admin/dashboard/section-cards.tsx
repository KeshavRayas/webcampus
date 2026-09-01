import { Badge } from "@webcampus/ui/components/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { ArrowUpRight, Building2, GraduationCap, Users } from "lucide-react";

const metrics = [
  { label: "Departments", value: "18", note: "All departments active", icon: Building2, change: "+2" },
  { label: "Students", value: "12,480", note: "Across current semesters", icon: GraduationCap, change: "+6.4%" },
  { label: "Faculty", value: "642", note: "Teaching and support staff", icon: Users, change: "+12" },
  { label: "Open actions", value: "27", note: "Items needing attention", icon: ArrowUpRight, change: "Review" },
];

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {metrics.map(({ label, value, note, icon: Icon, change }) => (
        <Card key={label} className="@container/card">
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {value}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1.5 px-3 py-1 font-semibold">
                <Icon className="size-3.5" />
                {change}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">{note}</CardFooter>
        </Card>
      ))}
    </div>
  );
}
