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
      <TabsList className="rounded-full p-1">
        <TabsTrigger className="rounded-full px-4" value="registration">
          Course Registration
        </TabsTrigger>
        <TabsTrigger className="rounded-full px-4" value="enrolled">
          Enrolled Courses
        </TabsTrigger>
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
