"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
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
import { Plus, Users } from "lucide-react";
import React, { useState } from "react";
import { AssignStudentDialog } from "./assign-student-dialog";

interface StudentSection {
  id: string;
  student: {
    id: string;
    usn: string;
    user: {
      name: string;
      email: string;
    };
  };
}

interface SectionWithStudents {
  id: string;
  name: string;
  semesterId: string;
  studentSections: StudentSection[];
  _count: {
    studentSections: number;
  };
}

export const SectionCardsView = () => {
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const departmentName = session?.user?.name ?? "";

  const [termId, setTermId] = useState<string>("");
  const [semesterId, setSemesterId] = useState<string>("");

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{
    sectionId: string;
    sectionName: string;
  }>({ sectionId: "", sectionName: "" });

  // Fetch academic terms
  const { data: terms } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [] as AcademicTermResponseType[];
    },
  });

  const termOptions = Array.isArray(terms) ? terms : [];
  const selectedTerm = termOptions.find((t) => t.id === termId);
  const nestedSemesters = selectedTerm?.Semester || [];
  const academicYear = selectedTerm?.year ?? "";

  // Fetch sections with students
  const { data: sections, isLoading } = useQuery({
    queryKey: ["sections-with-students", semesterId, departmentName],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SectionWithStudents[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/with-students`,
        {
          params: { semesterId, departmentName },
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return [] as SectionWithStudents[];
    },
    enabled: !!semesterId && !!departmentName,
  });

  return (
    <div className="space-y-4">
      {/* Term → Semester selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Academic Term</label>
          <Select
            value={termId}
            onValueChange={(value) => {
              setTermId(value);
              setSemesterId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select term..." />
            </SelectTrigger>
            <SelectContent>
              {termOptions.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.type.charAt(0).toUpperCase() + term.type.slice(1)}{" "}
                  {term.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Semester</label>
          <Select
            value={semesterId}
            onValueChange={setSemesterId}
            disabled={!termId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select semester..." />
            </SelectTrigger>
            <SelectContent>
              {nestedSemesters.map((semester) => (
                <SelectItem key={semester.id} value={semester.id}>
                  {semester.programType} - Semester {semester.semesterNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section Cards Grid */}
      {isLoading && semesterId && (
        <p className="text-muted-foreground text-sm">Loading sections...</p>
      )}

      {sections && sections.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Card key={section.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">
                  Section {section.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {section._count.studentSections}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setAssignTarget({
                        sectionId: section.id,
                        sectionName: section.name,
                      });
                      setAssignOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="sr-only">Add student</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">USN</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.studentSections.map((ss) => (
                        <TableRow key={ss.id}>
                          <TableCell className="font-mono text-xs">
                            {ss.student.usn}
                          </TableCell>
                          <TableCell className="text-xs">
                            {ss.student.user.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {ss.student.user.email}
                          </TableCell>
                        </TableRow>
                      ))}
                      {section.studentSections.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-muted-foreground text-center text-xs"
                          >
                            No students assigned
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sections && sections.length === 0 && semesterId && (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
          <Users className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">
            No sections found for this semester. Use the Generate button to
            create sections.
          </p>
        </div>
      )}

      {/* Assign Student Dialog */}
      <AssignStudentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        sectionId={assignTarget.sectionId}
        sectionName={assignTarget.sectionName}
        semesterId={semesterId}
        departmentName={departmentName}
        academicYear={academicYear}
      />
    </div>
  );
};
