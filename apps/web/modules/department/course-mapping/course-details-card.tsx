"use client";

import { CourseResponseDTO } from "@webcampus/schemas/department";
import { Badge } from "@webcampus/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@webcampus/ui/components/card";

interface CourseDetailsCardProps {
  course: CourseResponseDTO;
}

export const CourseDetailsCard = ({ course }: CourseDetailsCardProps) => {
  const hasLaboratory = course.practicalCredits > 0;
  const hasTheory = course.lectureCredits > 0 || course.tutorialCredits > 0;

  return (
    <Card className="w-full">
      <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex flex-col gap-1 md:w-1/3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
              {course.code}
            </span>
          </div>
          <span className="font-bold text-lg leading-tight truncate" title={course.name}>
            {course.name}
          </span>
        </div>

        {/* Middle: Tags and Requirements */}
        <div className="flex flex-col gap-2 md:w-1/3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs py-0 h-5">
              {course.courseMode.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className="text-xs py-0 h-5">
              {course.courseType}
            </Badge>
            {course.cycle && course.cycle !== "NONE" && (
              <Badge variant="outline" className="bg-primary/5 text-xs py-0 h-5">
                {course.cycle} CYCLE
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className={`size-1.5 rounded-full ${hasTheory ? "bg-green-500" : "bg-muted"}`} />
              <span className={hasTheory ? "font-medium" : "text-muted-foreground line-through"}>
                Theory
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`size-1.5 rounded-full ${hasLaboratory ? "bg-blue-500" : "bg-muted"}`} />
              <span className={hasLaboratory ? "font-medium" : "text-muted-foreground line-through"}>
                Lab
              </span>
            </div>
          </div>
        </div>

        {/* Right: Credits */}
        <div className="flex flex-col items-start md:items-end gap-1 md:w-1/3">
          <span className="text-xs font-medium text-muted-foreground mb-0.5">Credits</span>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="px-1.5 py-0 h-5 font-mono">
              L: {course.lectureCredits}
            </Badge>
            <Badge variant="outline" className="px-1.5 py-0 h-5 font-mono">
              T: {course.tutorialCredits}
            </Badge>
            <Badge variant="outline" className="px-1.5 py-0 h-5 font-mono">
              P: {course.practicalCredits}
            </Badge>
            <Badge variant="outline" className="px-1.5 py-0 h-5 font-mono">
              S: {course.skillCredits}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-medium mt-0.5 md:mr-1">
            Total: {course.totalCredits}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
