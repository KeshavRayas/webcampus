"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import axios from "axios";
import Link from "next/link";

type DashboardRound = {
  id: string;
  roundNumber: number;
  name: string;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
  academicTerm: { type: string; year: string; isCurrent: boolean };
  semester: { programType: "UG" | "PG"; semesterNumber: number };
  responseCount: number;
  status: "DISABLED" | "UPCOMING" | "ONGOING" | "COMPLETED";
};

const STATUS_LABEL: Record<DashboardRound["status"], string> = {
  DISABLED: "Disabled",
  UPCOMING: "Upcoming",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
};

const STATUS_CLASS: Record<DashboardRound["status"], string> = {
  DISABLED: "text-muted-foreground",
  UPCOMING: "text-muted-foreground",
  ONGOING: "text-primary",
  COMPLETED: "text-emerald-600",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function FeedbackDashboardView() {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["feedback-dashboard"],
    queryFn: async () =>
      (
        await axios.get(
          `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/dashboard`,
          {
            withCredentials: true,
          }
        )
      ).data.data as DashboardRound[],
  });

  if (isLoading)
    return <div className="p-6 text-sm">Loading feedback dashboard...</div>;
  if (isError || !data)
    return (
      <div className="text-destructive p-6 text-sm">
        Unable to load feedback dashboard.
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Feedback Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          All feedback rounds across academic terms and semesters. Click View
          more to drill into responses.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Feedbacks</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Academic Term</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-muted-foreground text-center"
                  >
                    No feedback rounds configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell>
                      {round.academicTerm.type.toUpperCase()}{" "}
                      {round.academicTerm.year}
                      {round.academicTerm.isCurrent ? " (Current)" : ""}
                    </TableCell>
                    <TableCell>
                      {round.semester.programType.toUpperCase()} - Semester{" "}
                      {round.semester.semesterNumber}
                    </TableCell>
                    <TableCell>{round.name}</TableCell>
                    <TableCell>{formatDate(round.startsAt)}</TableCell>
                    <TableCell>{formatDate(round.endsAt)}</TableCell>
                    <TableCell className={STATUS_CLASS[round.status]}>
                      {STATUS_LABEL[round.status]}
                    </TableCell>
                    <TableCell>{round.responseCount}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/admin/academics/feedback/rounds/${round.id}`}
                        >
                          View more
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
