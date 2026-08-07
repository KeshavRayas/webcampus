"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";

export type EligibleCourseRow = {
  courseId: string;
  code: string;
  name: string;
  totalCredits: number;
  semester: number;
  academicYear: string;
  courseType: string;
  courseMode: string;
  isRegistered: boolean;
};

type BuildColumnsParams = {
  onRegister: (course: EligibleCourseRow) => void;
  registeringCourseId?: string;
};

export const buildCourseRegistrationColumns = ({
  onRegister,
  registeringCourseId,
}: BuildColumnsParams): ColumnDef<EligibleCourseRow>[] => {
  return [
    {
      accessorKey: "code",
      header: "Code",
    },
    {
      accessorKey: "name",
      header: "Course",
    },
    {
      accessorKey: "courseType",
      header: "Type",
    },
    {
      accessorKey: "courseMode",
      header: "Mode",
    },
    {
      accessorKey: "totalCredits",
      header: "Credits",
    },
    {
      accessorKey: "semester",
      header: "Semester",
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isRegistered = row.original.isRegistered;
        return (
          <Badge variant={isRegistered ? "default" : "outline"}>
            {isRegistered ? "Registered" : "Not Registered"}
          </Badge>
        );
      },
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const course = row.original;
        const isPending = registeringCourseId === course.courseId;

        return (
          <Button
            size="sm"
            onClick={() => onRegister(course)}
            disabled={course.isRegistered || isPending}
          >
            {course.isRegistered
              ? "Registered"
              : isPending
                ? "Registering..."
                : "Register"}
          </Button>
        );
      },
    },
  ];
};
