"use client";

import { QrScanner } from "@/modules/verification/qr-scanner";
import {
  useVerifyHallTicket,
  VerificationCourse,
  VerificationStudent,
} from "@/modules/verification/use-verification";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Card, CardContent } from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";

function ResultStudentCard({ student }: { student: VerificationStudent }) {
  const initials = student.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-20">
        {student.photo ? (
          <AvatarImage src={student.photo} alt={student.name} />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="space-y-1 text-sm">
        <p className="text-base font-semibold">{student.name}</p>
        <p className="font-mono text-xs">{student.usn}</p>
        <p>
          {student.programType ?? "N/A"} - Semester {student.currentSemester}
          {student.sectionName ? ` - Section ${student.sectionName}` : ""}
        </p>
        <p className="text-muted-foreground text-xs">
          {student.departmentName} &middot; {student.academicTermLabel}
        </p>
      </div>
    </div>
  );
}

function CourseTable({ courses }: { courses: VerificationCourse[] }) {
  if (courses.length === 0) {
    return <p className="text-muted-foreground text-sm">No courses.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Course Code</TableHead>
          <TableHead>Course Title</TableHead>
          <TableHead>CIE</TableHead>
          <TableHead>Attendance</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {courses.map((c) => (
          <TableRow key={c.courseCode}>
            <TableCell className="font-mono text-xs">{c.courseCode}</TableCell>
            <TableCell>{c.courseName}</TableCell>
            <TableCell>{c.cieTotal ?? "—"}</TableCell>
            <TableCell>
              {c.attendancePercentage != null
                ? `${c.attendancePercentage}%`
                : "—"}
            </TableCell>
            <TableCell>
              {c.eligible ? (
                <Badge
                  variant="default"
                  className="bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400"
                >
                  <CheckCircle2 className="mr-1 size-3" /> Eligible
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="mr-1 size-3" /> Not Eligible
                </Badge>
              )}
              {!c.eligible && c.reason ? (
                <span className="text-muted-foreground mt-1 block text-xs">
                  {c.reason}
                </span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export const HallTicketVerificationView = () => {
  const verifyMutation = useVerifyHallTicket();
  const [result, setResult] = useState<{
    valid: boolean;
    result: string;
    detail: string | null;
    student: VerificationStudent | null;
    courses?: VerificationCourse[];
  } | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [scanHint, setScanHint] = useState<string | null>(null);

  const runVerify = (token: string) => {
    verifyMutation.mutate(
      { token },
      {
        onSuccess: (data) => {
          setResult(data);
          setScanHint(null);
        },
      }
    );
  };

  const handleScan = (text: string) => {
    const value = text.trim();
    setTokenInput(value);
    if (!value.startsWith("WCHT_VERIFY:")) {
      setResult(null);
      setScanHint(
        "This QR code is not a WebCampus hall-ticket token. Please scan a current hall ticket."
      );
      return;
    }
    runVerify(value);
  };

  const handleManualVerify = () => {
    const value = tokenInput.trim();
    if (!value) return;
    if (!value.startsWith("WCHT_VERIFY:")) {
      setScanHint(
        "Enter a full WCHT_VERIFY: token from a current hall ticket QR code."
      );
      return;
    }
    runVerify(value);
  };

  const handleReset = () => {
    setResult(null);
    setTokenInput("");
    setScanHint(null);
  };

  const pending = verifyMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Hall Ticket Verification
        </h2>
        <p className="text-muted-foreground text-sm">
          Scan the QR code on a current hall ticket to verify identity and exam
          eligibility.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-6">
          <QrScanner onResult={handleScan} busy={pending} />

          <div className="flex items-center gap-2">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="bg-border h-px flex-1" />
          </div>

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="verify-token"
                className="text-muted-foreground text-xs"
              >
                Paste QR token
              </label>
              <input
                id="verify-token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="WCHT_VERIFY:..."
                className="bg-background h-[3.15rem] w-full rounded-md border px-4 text-sm"
              />
            </div>
            <Button
              onClick={() => void handleManualVerify()}
              disabled={pending}
              className="h-[3.15rem] w-full"
            >
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Verify
            </Button>
          </div>

          {scanHint && (
            <p className="text-muted-foreground bg-muted rounded-md border px-3 py-2 text-xs">
              {scanHint}
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card
          className={result.valid ? "border-emerald-500" : "border-destructive"}
        >
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center justify-between gap-2">
              {result.valid ? (
                <Badge
                  variant="default"
                  className="bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400"
                >
                  <CheckCircle2 className="mr-1 size-4" /> Valid
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="mr-1 size-4" />{" "}
                  {result.result.replace(/_/g, " ")}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RefreshCw className="mr-2 size-3" /> Scan another
              </Button>
            </div>

            {result.detail && (
              <p className="text-muted-foreground text-sm">{result.detail}</p>
            )}

            {result.student && (
              <>
                <ResultStudentCard student={result.student} />
                {result.courses && <CourseTable courses={result.courses} />}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
