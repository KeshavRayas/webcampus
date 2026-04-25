import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Card, CardContent, CardHeader } from "@webcampus/ui/components/card";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { Input } from "@webcampus/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { cn } from "@webcampus/ui/lib/utils";
import { useMemo, useState } from "react";
import { AttendanceChecklistRow } from "../faculty-attendance-types";

type AttendanceSectionProps = {
  studentChecklist: AttendanceChecklistRow[];
  isLoading: boolean;
  isSaving: boolean;
  onAllPresent: () => void;
  onAllAbsent: () => void;
  onToggleStatus: (studentId: string, isPresent: boolean) => void;
  totalStudents: number;
  className?: string;
};

export const AttendanceSection = ({
  studentChecklist,
  isLoading,
  isSaving,
  onAllPresent,
  onAllAbsent,
  onToggleStatus,
  totalStudents,
  className,
}: AttendanceSectionProps) => {
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return studentChecklist;
    }

    return studentChecklist.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.usn.toLowerCase().includes(query)
      );
    });
  }, [searchTerm, studentChecklist]);

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="border-primary/20 bg-background/95 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Student Roster</p>
              <p className="text-muted-foreground text-xs">
                Enrolled: {totalStudents}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAllPresent}
                disabled={studentChecklist.length === 0 || isSaving}
              >
                All Present
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAllAbsent}
                disabled={studentChecklist.length === 0 || isSaving}
              >
                All Absent
              </Button>
            </div>
          </div>

          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name or USN"
            className="h-10"
          />
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="border-border/60 bg-muted/40 h-16 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm">
              {studentChecklist.length === 0
                ? "No students were found for this attendance session."
                : "No students match your search."}
            </div>
          ) : (
            <div className="border-border/70 max-h-[55vh] overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">USN</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-36">Prev. Attendance %</TableHead>
                    <TableHead className="w-24 text-center">
                      Attendance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const rowToneClass =
                      student.status === "PRESENT"
                        ? "bg-emerald-500/10"
                        : student.status === "ABSENT"
                          ? "bg-rose-500/10"
                          : "";
                    const previousAttendance =
                      student.previousAttendancePercentage;

                    const attendanceBadge = (() => {
                      if (previousAttendance === undefined) {
                        return "N/A";
                      }
                      return `${previousAttendance}%`;
                    })();

                    const badgeColorClass = (() => {
                      if (previousAttendance === undefined) {
                        return "bg-muted text-muted-foreground";
                      }
                      if (previousAttendance >= 85) {
                        return "bg-emerald-500/15 text-emerald-700";
                      }
                      if (previousAttendance >= 75) {
                        return "bg-amber-500/15 text-amber-700";
                      }
                      return "bg-amber-500/15 text-rose-700";
                    })();

                    return (
                      <TableRow
                        key={student.studentId}
                        className={cn(rowToneClass)}
                      >
                        <TableCell className="font-mono text-xs tracking-wide">
                          {student.usn}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium leading-none">
                            {student.name}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(badgeColorClass)}
                          >
                            {attendanceBadge}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={student.status === "PRESENT"}
                              onCheckedChange={(checked) => {
                                onToggleStatus(
                                  student.studentId,
                                  checked === true
                                );
                              }}
                              disabled={isSaving}
                              aria-label={`Toggle attendance for ${student.name}`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
