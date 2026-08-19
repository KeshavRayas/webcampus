import { Badge } from "@webcampus/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import type { TimetableEntry } from "./timetable-types";

export function TimetableList({
  entries,
  title,
}: {
  entries: TimetableEntry[];
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry) => (
          <div className="rounded-lg border p-4" key={entry.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {entry.course?.code ?? "Course"} ·{" "}
                  {entry.course?.name ?? "Unnamed course"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {entry.faculty?.user?.name ??
                    entry.faculty?.shortName ??
                    "Faculty not assigned"}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                {entry.dayOfWeek} · {entry.startTime} - {entry.endTime}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Badge variant="outline">{entry.classType}</Badge>
              <Badge
                variant={entry.status === "PUBLISHED" ? "default" : "secondary"}
              >
                {entry.status}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {entry.roomNumber}
              </span>
            </div>
          </div>
        ))}
        {!entries.length && (
          <p className="text-muted-foreground text-sm">
            No timetable entries available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
