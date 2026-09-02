"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";
import { useState } from "react";
import { GenerateProctorGroupsDialog } from "./generate-proctor-groups-dialog";
import { ProctorGroupsTab } from "./proctor-groups-tab";
import { ProctorStudentsTab } from "./proctor-students-tab";

export const DepartmentProctorMappingView = () => {
  const [termId, setTermId] = useState<string>("all");
  const [semesterId, setSemesterId] = useState<string>("all");

  const { data: terms } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const res =
        await apiClient.get<BaseResponse<AcademicTermResponseType[]>>(
          `/admin/semester`
        );
      if (res.data.status === "success") return res.data.data;
      return [] as AcademicTermResponseType[];
    },
  });

  const selectedTerm = terms?.find((t) => t.id === termId);
  const semesters = selectedTerm?.Semester || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Proctor Mapping</h2>
        <div className="flex items-center gap-4">
          <Select
            value={termId}
            onValueChange={(val) => {
              setTermId(val);
              setSemesterId("all");
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms</SelectItem>
              {terms?.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.type} ({term.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={semesterId}
            onValueChange={setSemesterId}
            disabled={termId === "all"}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Semesters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesters.map(
                (sem: {
                  id: string;
                  semesterNumber: number;
                  programType: string;
                }) => (
                  <SelectItem key={sem.id} value={sem.id}>
                    Semester {sem.semesterNumber} ({sem.programType})
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <GenerateProctorGroupsDialog />
        </div>
      </div>

      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="mt-0">
          <ProctorGroupsTab
            semesterId={semesterId === "all" ? undefined : semesterId}
          />
        </TabsContent>
        <TabsContent value="students" className="mt-0">
          <ProctorStudentsTab
            semesterId={semesterId === "all" ? undefined : semesterId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
