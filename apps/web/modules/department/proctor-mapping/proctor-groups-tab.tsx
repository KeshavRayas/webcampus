/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
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
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

export const ProctorGroupsTab = ({ semesterId }: { semesterId?: string }) => {
  const queryClient = useQueryClient();
  const [newGroup, setNewGroup] = useState("");

  const { data: groups, isLoading } = useQuery({
    queryKey: ["proctor-groups", semesterId],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/department/proctor`, {
        params: { semesterId },
      });
      return res.data.data || [];
    },
  });

  const { data: faculties } = useQuery({
    queryKey: ["department-faculties"],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/department/faculty`);
      return res.data.data || [];
    },
  });

  const createGroup = useMutation({
    mutationFn: async (groupNumber: string) => {
      const res = await apiClient.post(`/department/proctor`, { groupNumber });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proctor-groups"] });
      toast.success("Group created successfully");
      setNewGroup("");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create group");
    },
  });

  const assignFaculty = useMutation({
    mutationFn: async ({
      id,
      facultyId,
    }: {
      id: string;
      facultyId: string | null;
    }) => {
      const res = await apiClient.put(`/department/proctor/${id}`, {
        facultyId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proctor-groups"] });
      toast.success("Faculty assigned successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to assign faculty");
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/department/proctor/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proctor-groups"] });
      toast.success("Group deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete group");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Proctor Groups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Input
            placeholder="e.g. PR-1"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            className="max-w-xs"
          />
          <Button
            onClick={() => createGroup.mutate(newGroup)}
            disabled={!newGroup || createGroup.isPending}
          >
            Create Group
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Number</TableHead>
                <TableHead>Assigned Faculty</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading groups...
                  </TableCell>
                </TableRow>
              ) : groups?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No proctor groups created yet.
                  </TableCell>
                </TableRow>
              ) : (
                groups?.map((group: any) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      {group.groupNumber}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={group.facultyId || "unassigned"}
                        onValueChange={(value) =>
                          assignFaculty.mutate({
                            id: group.id,
                            facultyId: value === "unassigned" ? null : value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Assign a faculty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {faculties?.map((faculty: any) => (
                            <SelectItem key={faculty.id} value={faculty.id}>
                              {faculty.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{group._count?.students || 0}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this group?"
                            )
                          ) {
                            deleteGroup.mutate(group.id);
                          }
                        }}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
