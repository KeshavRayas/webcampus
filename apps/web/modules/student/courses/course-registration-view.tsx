"use client";

import {
  buildCourseRegistrationColumns,
  type EligibleCourseRow,
} from "@/modules/student/courses/columns";
import { DataTable } from "@/modules/student/courses/data-table";
import {
  useEligibleCourseRegistration,
  useRegisterCourse,
} from "@/modules/student/courses/use-course-registration";
import { getApiErrorMessage } from "@/lib/api-client";
import { useMemo } from "react";

export const CourseRegistrationView = () => {
  const {
    data: courses,
    isLoading,
    isError,
    error,
  } = useEligibleCourseRegistration();
  const registerCourseMutation = useRegisterCourse();

  const registeringCourseId =
    registerCourseMutation.isPending && registerCourseMutation.variables
      ? registerCourseMutation.variables.courseId
      : undefined;

  const columns = useMemo(
    () =>
      buildCourseRegistrationColumns({
        onRegister: (course) => handleRegister(course),
        registeringCourseId,
      }),
    [registeringCourseId]
  );

  const handleRegister = (course: EligibleCourseRow) => {
    registerCourseMutation.mutate({
      courseId: course.courseId,
      semester: course.semester,
      academicYear: course.academicYear,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">Loading course registration...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {getApiErrorMessage(error, "Unable to load course registration")}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Course Registration</h2>
        <p className="text-muted-foreground text-sm">
          Register for approved courses assigned to your section or batch.
        </p>
      </header>

      <div className="bg-card rounded-xl border p-4">
        <DataTable columns={columns} data={courses ?? []} />
      </div>
    </section>
  );
};
