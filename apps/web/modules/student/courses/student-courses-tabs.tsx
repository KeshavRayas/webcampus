"use client";

import { CourseRegistrationView } from "@/modules/student/courses/course-registration-view";
import { EnrolledCoursesView } from "@/modules/student/courses/enrolled-courses-view";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";

export const StudentCoursesTabs = () => {
  return (
    <Tabs defaultValue="registration" className="space-y-6">
      <TabsList>
        <TabsTrigger value="registration">Course Registration</TabsTrigger>
        <TabsTrigger value="enrolled">Enrolled Courses</TabsTrigger>
      </TabsList>

      <TabsContent value="registration">
        <CourseRegistrationView />
      </TabsContent>

      <TabsContent value="enrolled">
        <EnrolledCoursesView />
      </TabsContent>
    </Tabs>
  );
};
