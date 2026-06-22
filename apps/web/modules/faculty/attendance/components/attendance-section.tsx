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
        <CardHeader className="space-y-3 px-4 pb-4 sm:px-6">
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

        <CardContent className="px-2 sm:px-6">
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
            <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              {studentChecklist.length === 0
                ? "No students were found for this attendance session."
                : "No students match your search."}
            </div>
          ) : (
            <div className="border-border/70 max-h-[55vh] overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Tightly packed mobile columns */}
                    <TableHead className="w-20 px-2 text-xs sm:w-32 sm:text-sm">
                      USN
                    </TableHead>
                    <TableHead className="min-w-25 px-2 text-xs sm:text-sm">
                      Name
                    </TableHead>
                    <TableHead className="w-20 px-2 text-center text-xs sm:w-28 sm:text-sm">
                      Attendance
                    </TableHead>
                    <TableHead className="w-16 px-2 text-center text-xs sm:w-24 sm:text-sm">
                      Prev. %
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
                        <TableCell className="px-2 py-2 align-middle font-mono text-[10px] tracking-wide sm:text-xs">
                          {student.usn}
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <p className="text-xs font-medium leading-tight sm:text-sm">
                            {student.name}
                          </p>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center align-middle">
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
                              className="h-5 w-5 sm:h-4 sm:w-4" // Slightly larger tap target on mobile
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center align-middle">
                          <Badge
                            variant="secondary"
                            className={cn(
                              badgeColorClass,
                              "px-1 text-[10px] sm:px-2.5 sm:text-xs"
                            )}
                          >
                            {attendanceBadge}
                          </Badge>
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
