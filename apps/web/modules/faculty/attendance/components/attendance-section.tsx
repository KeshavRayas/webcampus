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
  onToggleStatus: (studentId: string, nextStatus: "PRESENT" | "ABSENT") => void;
  markedCount: number;
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
  markedCount,
  totalStudents,
  className,
}: AttendanceSectionProps) => {
  const [searchTerm, setSearchTerm] = useState<string>("");

  const progressPercentage =
    totalStudents > 0 ? (markedCount / totalStudents) * 100 : 0;
  const roundedProgressPercentage = Math.round(progressPercentage);

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
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Progress</p>
            <p className="text-muted-foreground text-xs">
              {markedCount} / {totalStudents} marked ({roundedProgressPercentage}%)
            </p>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Attendance marked progress"
            aria-valuemin={0}
            aria-valuemax={totalStudents}
            aria-valuenow={markedCount}
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
              aria-hidden="true"
            />
          </div>
        </CardHeader>
      </Card>

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
                  className="h-16 animate-pulse rounded-lg border border-border/60 bg-muted/40"
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
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">USN</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-36">Prev. Attendance %</TableHead>
                    <TableHead className="w-24 text-center">Present</TableHead>
                    <TableHead className="w-24 text-center">Absent</TableHead>
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
                    const previousAttendance = student.previousAttendancePercentage;

                    return (
                      <TableRow key={student.studentId} className={cn(rowToneClass)}>
                        <TableCell className="font-mono text-xs tracking-wide">
                          {student.usn}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium leading-none">{student.name}</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              previousAttendance >= 85
                                ? "bg-emerald-500/15 text-emerald-700"
                                : previousAttendance >= 75
                                  ? "bg-amber-500/15 text-amber-700"
                                  : "bg-rose-500/15 text-rose-700"
                            )}
                          >
                            {previousAttendance}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={student.status === "PRESENT"}
                              onCheckedChange={() => {
                                onToggleStatus(student.studentId, "PRESENT");
                              }}
                              disabled={isSaving}
                              aria-label={`Mark ${student.name} as present`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={student.status === "ABSENT"}
                              onCheckedChange={() => {
                                onToggleStatus(student.studentId, "ABSENT");
                              }}
                              disabled={isSaving}
                              aria-label={`Mark ${student.name} as absent`}
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
