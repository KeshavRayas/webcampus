"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Switch } from "@webcampus/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useState } from "react";
import {
  PromotionCandidateItem,
  usePromoteStudents,
  usePromotionCandidates,
  usePromotionHistory,
} from "./use-promotion";

interface FlatSemesterOption {
  id: string;
  label: string;
  programType: "UG" | "PG";
  semesterNumber: number;
}

export const PromotionView = () => {
  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const semesterOptions: FlatSemesterOption[] = terms.flatMap((term) =>
    (term.Semester ?? []).map((semester) => ({
      id: semester.id,
      label: `${term.type.toUpperCase()} ${term.year} - ${semester.programType} Sem ${semester.semesterNumber}`,
      programType: semester.programType as "UG" | "PG",
      semesterNumber: semester.semesterNumber,
    }))
  );

  const [fromSemesterId, setFromSemesterId] = useState("");
  const [toSemesterId, setToSemesterId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [promoteFirstYearSections, setPromoteFirstYearSections] =
    useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const fromSemester = semesterOptions.find(
    (semester) => semester.id === fromSemesterId
  );
  const toSemester = semesterOptions.find(
    (semester) => semester.id === toSemesterId
  );

  const isValidPair =
    !!fromSemester &&
    !!toSemester &&
    fromSemester.programType === toSemester.programType &&
    toSemester.semesterNumber === fromSemester.semesterNumber + 1;

  const candidatesQuery = usePromotionCandidates(
    fromSemesterId || undefined,
    toSemesterId || undefined,
    isValidPair
  );

  const historyQuery = usePromotionHistory({
    page: historyPage,
    pageSize: 10,
  });

  const { mutate: promoteStudents, isPending: isPromoting } =
    usePromoteStudents();

  const candidates = candidatesQuery.data;
  const eligibleStudents = candidates?.eligible ?? [];
  const nonEligibleStudents = candidates?.nonEligible ?? [];
  const allSelected =
    eligibleStudents.length > 0 &&
    eligibleStudents.every((student) => selectedIds.has(student.studentId));

  const toggleStudent = (studentId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(() => {
      if (allSelected) {
        return new Set();
      }
      return new Set(eligibleStudents.map((student) => student.studentId));
    });
  };

  const handlePromote = () => {
    if (!fromSemesterId || !toSemesterId || selectedIds.size === 0) {
      return;
    }

    promoteStudents({
      fromSemesterId,
      toSemesterId,
      studentIds: Array.from(selectedIds),
      ...(notes ? { notes } : {}),
      ...(academicYear ? { academicYear } : {}),
      promoteFirstYearSections:
        fromSemester?.semesterNumber === 1 && promoteFirstYearSections,
    });

    setSelectedIds(new Set());
  };

  const renderCandidateRow = (student: PromotionCandidateItem) => (
    <TableRow key={student.studentId}>
      <TableCell>
        <Checkbox
          checked={selectedIds.has(student.studentId)}
          onCheckedChange={() => toggleStudent(student.studentId)}
        />
      </TableCell>
      <TableCell className="font-medium">{student.usn}</TableCell>
      <TableCell>{student.name}</TableCell>
      <TableCell>{student.departmentName}</TableCell>
      <TableCell>Sem {student.currentSemester}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Student Promotion
        </h3>
        <p className="text-muted-foreground text-sm">
          Promote students between consecutive semesters with an auditable
          history.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>From Semester</Label>
            <Select
              value={fromSemesterId}
              onValueChange={(value) => {
                setFromSemesterId(value);
                setSelectedIds(new Set());
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source semester" />
              </SelectTrigger>
              <SelectContent>
                {semesterOptions.map((semester) => (
                  <SelectItem key={semester.id} value={semester.id}>
                    {semester.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To Semester</Label>
            <Select
              value={toSemesterId}
              onValueChange={(value) => {
                setToSemesterId(value);
                setSelectedIds(new Set());
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target semester" />
              </SelectTrigger>
              <SelectContent>
                {semesterOptions.map((semester) => (
                  <SelectItem key={semester.id} value={semester.id}>
                    {semester.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fromSemesterId && toSemesterId && !isValidPair && (
          <p className="text-destructive text-sm">
            Target must be the next semester in the same program type.
          </p>
        )}

        {candidates && (
          <>
            <p className="text-sm font-medium">
              From{" "}
              <span className="font-semibold">
                {candidates.fromSemester.academicTermLabel} Sem{" "}
                {candidates.fromSemester.semesterNumber}
              </span>{" "}
              to{" "}
              <span className="font-semibold">
                {candidates.toSemester.academicTermLabel} Sem{" "}
                {candidates.toSemester.semesterNumber}
              </span>
            </p>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        disabled={eligibleStudents.length === 0}
                      />
                    </TableHead>
                    <TableHead>USN</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Current</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleStudents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground h-16 text-center"
                      >
                        No eligible students.
                      </TableCell>
                    </TableRow>
                  ) : (
                    eligibleStudents.map(renderCandidateRow)
                  )}
                </TableBody>
              </Table>
            </div>

            {nonEligibleStudents.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>USN</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Reasons</TableHead>
                      <TableHead>Backlogs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nonEligibleStudents.map((student) => (
                      <TableRow key={student.studentId}>
                        <TableCell className="font-medium">
                          {student.usn}
                        </TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {student.reasons.join(", ")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {student.outstandingBacklogs
                            .map((backlog) => backlog.courseCode)
                            .join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="promotion-notes">Notes (optional)</Label>
            <Input
              id="promotion-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Reason or remarks"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-year">
              Academic Year (required for first year section promotion)
            </Label>
            <Input
              id="promotion-year"
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
              placeholder="e.g. 2026-27"
            />
          </div>
        </div>

        {fromSemester?.semesterNumber === 1 && (
          <div className="flex items-center gap-3">
            <Switch
              id="first-year-sections"
              checked={promoteFirstYearSections}
              onCheckedChange={(checked) =>
                setPromoteFirstYearSections(checked)
              }
            />
            <Label htmlFor="first-year-sections">
              Also promote first year sections (creates cycle-swapped S2
              sections)
            </Label>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handlePromote}
            disabled={
              isPromoting ||
              !isValidPair ||
              selectedIds.size === 0 ||
              (fromSemester?.semesterNumber === 1 &&
                promoteFirstYearSections &&
                !academicYear)
            }
          >
            {isPromoting
              ? "Promoting..."
              : `Promote ${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Promotion History</h4>
        {!historyQuery.data ? (
          <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
            Loading promotion history...
          </div>
        ) : historyQuery.data.data.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
            No promotions recorded yet.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Moved</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Promoted By</TableHead>
                    <TableHead>At</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.data.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">{item.student.usn}</span>
                        {" — "}
                        {item.student.user.name}
                      </TableCell>
                      <TableCell>
                        Sem {item.fromSemesterNumber} → Sem{" "}
                        {item.toSemesterNumber}
                      </TableCell>
                      <TableCell>
                        {item.academicTerm.type} {item.academicTerm.year}
                      </TableCell>
                      <TableCell>{item.promotedBy.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(item.promotedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {item.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={historyQuery.data.page <= 1}
                onClick={() =>
                  setHistoryPage((current) => Math.max(1, current - 1))
                }
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {historyQuery.data.page} of {historyQuery.data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  historyQuery.data.page >= historyQuery.data.totalPages
                }
                onClick={() => setHistoryPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
