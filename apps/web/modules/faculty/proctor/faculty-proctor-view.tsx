/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
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

export const FacultyProctorView = () => {
  const { data: groups, isLoading } = useQuery({
    queryKey: ["faculty-proctor-groups"],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/faculty/proctor/students`);
      return res.data.data || [];
    },
  });

  if (isLoading) return <div className="p-4">Loading assigned students...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Proctor Mapping</h2>
      {groups?.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No proctor groups assigned to you.
        </p>
      ) : (
        groups?.map((group: any) => (
          <Card key={group.id} className="mb-6">
            <CardHeader>
              <CardTitle>Group: {group.groupNumber}</CardTitle>
            </CardHeader>
            <CardContent>
              {group.students && group.students.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>USN</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Semester</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.students.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            {student.usn}
                          </TableCell>
                          <TableCell>{student.user?.name}</TableCell>
                          <TableCell>{student.user?.email}</TableCell>
                          <TableCell>{student.semesterNumber}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No students in this group.
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
