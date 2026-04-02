"use client";

import { CourseResponseDTO } from "@webcampus/schemas/department";
import { Badge } from "@webcampus/ui/components/badge";
import { Card, CardContent } from "@webcampus/ui/components/card";

interface CourseDetailsCardProps {
  course: CourseResponseDTO;
}

export const CourseDetailsCard = ({ course }: CourseDetailsCardProps) => {
  const hasLaboratory = course.practicalCredits > 0;
  const hasTheory = course.lectureCredits > 0 || course.tutorialCredits > 0;

  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-start justify-between gap-4 p-4 md:flex-row md:items-center">
        {/* Left: Identity */}
        <div className="flex flex-col gap-1 md:w-1/3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
              {course.code}
            </span>
          </div>
          <span
            className="truncate text-lg font-bold leading-tight"
            title={course.name}
          >
            {course.name}
          </span>
        </div>

        {/* Middle: Tags and Requirements */}
        <div className="flex flex-col gap-2 md:w-1/3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="h-5 py-0 text-xs">
              {course.courseMode.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className="h-5 py-0 text-xs">
              {course.courseType}
            </Badge>
            {course.cycle && course.cycle !== "NONE" && (
              <Badge
                variant="outline"
                className="bg-primary/5 h-5 py-0 text-xs"
              >
                {course.cycle} CYCLE
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div
                className={`size-1.5 rounded-full ${hasTheory ? "bg-green-500" : "bg-muted"}`}
              />
              <span
                className={
                  hasTheory
                    ? "font-medium"
                    : "text-muted-foreground line-through"
                }
              >
                Theory
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={`size-1.5 rounded-full ${hasLaboratory ? "bg-blue-500" : "bg-muted"}`}
              />
              <span
                className={
                  hasLaboratory
                    ? "font-medium"
                    : "text-muted-foreground line-through"
                }
              >
                Lab
              </span>
            </div>
          </div>
        </div>

        {/* Right: Credits */}
        <div className="flex flex-col items-start gap-1 md:w-1/3 md:items-end">
          <span className="text-muted-foreground mb-0.5 text-xs font-medium">
            Credits
          </span>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono">
              L: {course.lectureCredits}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono">
              T: {course.tutorialCredits}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono">
              P: {course.practicalCredits}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono">
              S: {course.skillCredits}
            </Badge>
          </div>
          <span className="text-muted-foreground mt-0.5 text-xs font-medium md:mr-1">
            Total: {course.totalCredits}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
