/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Checkbox } from "@webcampus/ui/components/checkbox";
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
import axios from "axios";
import { useState } from "react";
import { toast } from "react-toastify";

export const ProctorStudentsTab = ({ semesterId }: { semesterId?: string }) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("unassigned");

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["proctor-students", semesterId],
    queryFn: async () => {
      const res = await axios.get<any>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/proctor/students`,
        {
          params: { semesterId },
          withCredentials: true,
        }
      );
      return res.data.data || [];
    },
  });

  const { data: groups } = useQuery({
    queryKey: ["proctor-groups", semesterId],
    queryFn: async () => {
      const res = await axios.get<any>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/proctor`,
        {
          params: { semesterId },
          withCredentials: true,
        }
      );
      return res.data.data || [];
    },
  });

  const assignStudents = useMutation({
    mutationFn: async ({
      studentIds,
      proctorGroupId,
    }: {
      studentIds: string[];
      proctorGroupId: string | null;
    }) => {
      const res = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/proctor/assign-students`,
        { studentIds, proctorGroupId },
        { withCredentials: true }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proctor-students"] });
      queryClient.invalidateQueries({ queryKey: ["proctor-groups"] });
      toast.success("Students assigned successfully");
      setSelectedStudents([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to assign students");
    },
  });

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (students && students.length > 0) {
      if (students.length === selectedStudents.length) {
        setSelectedStudents([]);
      } else {
        setSelectedStudents(students.map((s: any) => s.id));
      }
    }
  };

  const handleAssign = () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student");
      return;
    }
    assignStudents.mutate({
      studentIds: selectedStudents,
      proctorGroupId: selectedGroup === "unassigned" ? null : selectedGroup,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign Students to Proctor Groups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a proctor group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {groups?.map((group: any) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.groupNumber}{" "}
                  {group.faculty ? `(${group.faculty.user?.name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAssign}
            disabled={assignStudents.isPending || selectedStudents.length === 0}
          >
            Assign Selected ({selectedStudents.length})
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      students &&
                      students.length > 0 &&
                      selectedStudents.length === students.length
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>USN</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Current Group</TableHead>
                <TableHead>Move</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Loading students...
                  </TableCell>
                </TableRow>
              ) : students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No students found.
                  </TableCell>
                </TableRow>
              ) : (
                students?.map((student: any) => {
                  const group = groups?.find(
                    (g: any) => g.id === student.proctorGroupId
                  );
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.usn}
                      </TableCell>
                      <TableCell>{student.user?.name}</TableCell>
                      <TableCell>{student.semesterNumber}</TableCell>
                      <TableCell>
                        {group ? (
                          group.groupNumber
                        ) : (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={student.proctorGroupId || "unassigned"}
                          onValueChange={(value) => {
                            assignStudents.mutate({
                              studentIds: [student.id],
                              proctorGroupId:
                                value === "unassigned" ? null : value,
                            });
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Move to group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              Unassigned
                            </SelectItem>
                            {groups?.map((g: any) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.groupNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
