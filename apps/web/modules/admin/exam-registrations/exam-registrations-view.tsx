"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { Button } from "@webcampus/ui/components/button";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
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
  ExamRegistrationsQuery,
  useExamRegistrations,
} from "./use-exam-registrations";

const EXAM_TYPES = ["REGULAR", "REAPPEAR", "SUPPLEMENTARY", "MAKE_UP"] as const;
const EXAM_STATUSES = [
  "REGISTERED",
  "SEATED",
  "RESULT_DECLARED",
  "CANCELLED",
] as const;

type ExamTypeValue = ExamRegistrationsQuery["examType"];
type ExamStatusValue = ExamRegistrationsQuery["status"];

const EMPTY_SELECT = "__all__";

export const ExamRegistrationsView = () => {
  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const [academicTermId, setAcademicTermId] = useState("");
  const [appliedTermId, setAppliedTermId] = useState("");
  const [examType, setExamType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const query: ExamRegistrationsQuery = {
    academicTermId: appliedTermId,
    page,
    pageSize: 20,
    ...(examType ? { examType: examType as ExamTypeValue } : {}),
    ...(status ? { status: status as ExamStatusValue } : {}),
  };

  const registrationsQuery = useExamRegistrations(query, !!appliedTermId);
  const payload = registrationsQuery.data;
  const rows = payload?.data ?? [];

  const handleApply = () => {
    if (!academicTermId) {
      return;
    }
    setPage(1);
    setAppliedTermId(academicTermId);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Exam Registrations
        </h3>
        <p className="text-muted-foreground text-sm">
          Reappear and supplementary exam sign-ups per academic term.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Academic Term</Label>
          <Select value={academicTermId} onValueChange={setAcademicTermId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.type.toUpperCase()} {term.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Exam Type</Label>
          <Select
            value={examType || EMPTY_SELECT}
            onValueChange={(value) =>
              setExamType(value === EMPTY_SELECT ? "" : value)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT}>All types</SelectItem>
              {EXAM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status || EMPTY_SELECT}
            onValueChange={(value) =>
              setStatus(value === EMPTY_SELECT ? "" : value)
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT}>All statuses</SelectItem>
              {EXAM_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleApply} disabled={!academicTermId}>
          Apply
        </Button>
      </div>

      {!appliedTermId ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Select an academic term and apply to load exam registrations.
        </div>
      ) : registrationsQuery.isLoading ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Loading exam registrations...
        </div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No exam registrations found for the selected filters.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>USN</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Exam Type</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Registered At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.usn}</TableCell>
                    <TableCell>{row.studentName}</TableCell>
                    <TableCell>
                      {row.code} — {row.courseName}
                    </TableCell>
                    <TableCell>{row.examType}</TableCell>
                    <TableCell>{row.attemptNumber}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.outcome ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.seeMarks !== null
                        ? `${row.seeMarks}/${row.maxSeeMarks ?? "?"}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(row.registeredAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-muted-foreground text-sm">
              {payload?.total ?? 0} total
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {payload?.page ?? page} of {payload?.totalPages ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(payload?.totalPages ?? 1) <= page}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
