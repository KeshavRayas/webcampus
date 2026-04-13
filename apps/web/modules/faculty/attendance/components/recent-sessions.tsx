import { dayjs } from "@webcampus/common/dayjs";
import { Badge } from "@webcampus/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@webcampus/ui/components/card";
import { FacultyAttendanceSessionDTO } from "@webcampus/types/api";

type RecentSessionsProps = {
  sessions: FacultyAttendanceSessionDTO[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
};

export const RecentSessions = ({
  sessions,
  activeSessionId,
  onSelectSession,
}: RecentSessionsProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent sessions available.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(session.id)}
                className="hover:bg-muted/80 w-full rounded-lg border p-3 text-left transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {session.courseCode} - {session.courseName}
                  </p>
                  <Badge variant={activeSessionId === session.id ? "default" : "outline"}>
                    {activeSessionId === session.id ? "Active" : "Open"}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Section {session.sectionName} | {session.timingLabel} | {dayjs(session.sessionDate).format("MMM D, YYYY")}
                </p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
