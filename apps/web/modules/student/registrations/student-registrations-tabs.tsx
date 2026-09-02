"use client";

import { CourseRegistrationView } from "@/modules/student/courses/course-registration-view";
import {
  ExamRegistrationHistorySection,
  ExamRegistrationView,
} from "@/modules/student/registrations/exam-registration-view";
import {
  ReRegistrationHistorySection,
  ReRegistrationView,
} from "@/modules/student/registrations/re-registration-view";
import {
  SupplementaryHistorySection,
  SupplementaryView,
} from "@/modules/student/registrations/supplementary-view";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";

export const StudentRegistrationsTabs = () => {
  return (
    <Tabs defaultValue="current" className="space-y-6">
      <TabsList>
        <TabsTrigger value="current">Current</TabsTrigger>
        <TabsTrigger value="re-registration">
          Repeat / Re-registration
        </TabsTrigger>
        <TabsTrigger value="supplementary">Supplementary</TabsTrigger>
        <TabsTrigger value="exam">Exam Registration</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="current">
        <CourseRegistrationView />
      </TabsContent>

      <TabsContent value="re-registration">
        <ReRegistrationView />
      </TabsContent>

      <TabsContent value="supplementary">
        <SupplementaryView />
      </TabsContent>

      <TabsContent value="exam">
        <ExamRegistrationView />
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <ReRegistrationHistorySection />
        <SupplementaryHistorySection />
        <ExamRegistrationHistorySection />
      </TabsContent>
    </Tabs>
  );
};
